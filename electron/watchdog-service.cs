// ClipMaster Pro Watchdog Service
// Runs as LocalSystem. Every 60 seconds it checks whether ClipMaster Pro is
// running in the active console user session. If not, it launches the app in
// that session using CreateProcessAsUser so the user gets a visible window.
// Reacts immediately to SessionLogon, SessionUnlock and ConsoleConnect events.
//
// Written in C# 5 (compatible with csc.exe from .NET Framework 4.x).
//
// Compile:
//   csc.exe /target:exe /out:watchdog-service.exe
//           /reference:%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\System.ServiceProcess.dll
//           watchdog-service.cs

using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.ServiceProcess;
using System.Threading;
using Microsoft.Win32;

namespace ClipMasterPro
{
    // ── Windows API surface ────────────────────────────────────────────────
    internal static class NativeMethods
    {
        [DllImport("kernel32.dll")]
        internal static extern uint WTSGetActiveConsoleSessionId();

        [DllImport("wtsapi32.dll", SetLastError = true)]
        internal static extern bool WTSQueryUserToken(uint sessionId, out IntPtr phToken);

        [DllImport("advapi32.dll", SetLastError = true)]
        internal static extern bool DuplicateTokenEx(
            IntPtr hExistingToken,
            uint dwDesiredAccess,
            IntPtr lpTokenAttributes,
            int ImpersonationLevel,
            int TokenType,
            out IntPtr phNewToken);

        [DllImport("userenv.dll", SetLastError = true)]
        internal static extern bool CreateEnvironmentBlock(
            out IntPtr lpEnvironment, IntPtr hToken, bool bInherit);

        [DllImport("userenv.dll", SetLastError = true)]
        internal static extern bool DestroyEnvironmentBlock(IntPtr lpEnvironment);

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        internal static extern bool CreateProcessAsUser(
            IntPtr hToken,
            string lpApplicationName,
            string lpCommandLine,
            IntPtr lpProcessAttributes,
            IntPtr lpThreadAttributes,
            bool bInheritHandles,
            uint dwCreationFlags,
            IntPtr lpEnvironment,
            string lpCurrentDirectory,
            ref STARTUPINFO lpStartupInfo,
            out PROCESS_INFORMATION lpProcessInformation);

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool ProcessIdToSessionId(uint dwProcessId, out uint pSessionId);

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool CloseHandle(IntPtr hObject);
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    internal struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX, dwY, dwXSize, dwYSize;
        public int dwXCountChars, dwYCountChars;
        public int dwFillAttribute, dwFlags;
        public short wShowWindow, cbReserved2;
        public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct PROCESS_INFORMATION
    {
        public IntPtr hProcess, hThread;
        public int dwProcessId, dwThreadId;
    }

    // ── Service implementation ─────────────────────────────────────────────
    public sealed class WatchdogService : ServiceBase
    {
        private const uint MAXIMUM_ALLOWED           = 0x02000000;
        private const int  SECURITY_IMPERSONATION    = 2;
        private const int  TOKEN_PRIMARY             = 1;
        private const uint CREATE_UNICODE_ENVIRONMENT = 0x00000400;
        private const uint NORMAL_PRIORITY_CLASS     = 0x00000020;

        private const string SVC_NAME         = "ClipMasterProWatchdog";
        private const string APP_PROCESS      = "ClipMaster Pro";
        private const string APP_EXE          = "ClipMaster Pro.exe";
        private const string REG_KEY_HKLM     = @"SOFTWARE\ClipMaster Pro";
        private const string REG_INSTALL_PATH = "InstallPath";

        // Give Windows 45 s to fully boot before the first check.
        private const int INITIAL_DELAY_MS  = 45000;
        // Steady-state check interval.
        private const int CHECK_INTERVAL_MS = 60000;
        // After a session event, wait 20 s for the desktop to settle.
        private const int SESSION_SETTLE_MS = 20000;

        private Timer  _timer;
        private string _logPath;

        public WatchdogService()
        {
            ServiceName                 = SVC_NAME;
            CanHandleSessionChangeEvent = true;
            CanStop                     = true;
            AutoLog                     = false;
        }

        protected override void OnStart(string[] args)
        {
            string logDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "ClipMaster Pro");
            try { Directory.CreateDirectory(logDir); } catch { }
            _logPath = Path.Combine(logDir, "watchdog.log");
            TrimLog();

            Log("Service started (PID " + Process.GetCurrentProcess().Id.ToString() + "). " +
                "Initial check in " + (INITIAL_DELAY_MS / 1000).ToString() + "s, " +
                "then every " + (CHECK_INTERVAL_MS / 1000).ToString() + "s.");

            _timer = new Timer(OnTick, null, INITIAL_DELAY_MS, CHECK_INTERVAL_MS);
        }

        protected override void OnStop()
        {
            Log("Service stopping.");
            if (_timer != null)
            {
                _timer.Dispose();
                _timer = null;
            }
        }

        protected override void OnSessionChange(SessionChangeDescription change)
        {
            if (change.Reason == SessionChangeReason.SessionLogon   ||
                change.Reason == SessionChangeReason.SessionUnlock  ||
                change.Reason == SessionChangeReason.ConsoleConnect ||
                change.Reason == SessionChangeReason.RemoteConnect)
            {
                uint sid = (uint)change.SessionId;
                Log("Session event '" + change.Reason.ToString() + "' on session " +
                    sid.ToString() + ". Scheduling app-check in " +
                    (SESSION_SETTLE_MS / 1000).ToString() + "s...");

                // Capture sid in a local so the lambda closure captures the right value.
                uint capturedSid = sid;
                ThreadPool.QueueUserWorkItem(delegate(object state)
                {
                    Thread.Sleep(SESSION_SETTLE_MS);
                    CheckAndLaunch(capturedSid);
                });
            }
        }

        // ── Periodic tick ──────────────────────────────────────────────────
        private void OnTick(object state)
        {
            uint sessionId = NativeMethods.WTSGetActiveConsoleSessionId();
            if (sessionId == 0xFFFFFFFF) return;
            CheckAndLaunch(sessionId);
        }

        // ── Core logic ─────────────────────────────────────────────────────
        private void CheckAndLaunch(uint sessionId)
        {
            try
            {
                string exePath = ResolveExePath();
                if (string.IsNullOrEmpty(exePath))
                {
                    Log("InstallPath not found in HKLM registry — skipping launch check.");
                    return;
                }

                if (IsAppRunningInSession(sessionId)) return;

                Log("App not detected in session " + sessionId.ToString() +
                    ". Launching: " + exePath);
                LaunchInSession("\"" + exePath + "\" --hidden", sessionId);
            }
            catch (Exception ex)
            {
                Log("Error in CheckAndLaunch: " + ex.GetType().Name + ": " + ex.Message);
            }
        }

        private static bool IsAppRunningInSession(uint targetSessionId)
        {
            Process[] procs = Process.GetProcessesByName(APP_PROCESS);
            foreach (Process p in procs)
            {
                try
                {
                    uint sid;
                    if (NativeMethods.ProcessIdToSessionId((uint)p.Id, out sid)
                        && sid == targetSessionId)
                    {
                        return true;
                    }
                }
                catch { }
                finally
                {
                    try { p.Dispose(); } catch { }
                }
            }
            return false;
        }

        private bool LaunchInSession(string commandLine, uint sessionId)
        {
            IntPtr userToken    = IntPtr.Zero;
            IntPtr primaryToken = IntPtr.Zero;
            IntPtr envBlock     = IntPtr.Zero;

            try
            {
                if (!NativeMethods.WTSQueryUserToken(sessionId, out userToken))
                {
                    Log("WTSQueryUserToken failed (Win32 error " +
                        Marshal.GetLastWin32Error().ToString() + ").");
                    return false;
                }

                if (!NativeMethods.DuplicateTokenEx(
                        userToken, MAXIMUM_ALLOWED, IntPtr.Zero,
                        SECURITY_IMPERSONATION, TOKEN_PRIMARY, out primaryToken))
                {
                    Log("DuplicateTokenEx failed (Win32 error " +
                        Marshal.GetLastWin32Error().ToString() + ").");
                    return false;
                }

                NativeMethods.CreateEnvironmentBlock(out envBlock, primaryToken, false);

                STARTUPINFO si = new STARTUPINFO();
                si.cb        = Marshal.SizeOf(typeof(STARTUPINFO));
                si.lpDesktop = @"winsta0\default";

                PROCESS_INFORMATION pi;
                bool ok = NativeMethods.CreateProcessAsUser(
                    primaryToken,
                    null,
                    commandLine,
                    IntPtr.Zero, IntPtr.Zero,
                    false,
                    NORMAL_PRIORITY_CLASS | CREATE_UNICODE_ENVIRONMENT,
                    envBlock,
                    null,
                    ref si,
                    out pi);

                if (ok)
                {
                    Log("App launched in session " + sessionId.ToString() +
                        " (PID " + pi.dwProcessId.ToString() + ").");
                    if (pi.hProcess != IntPtr.Zero) NativeMethods.CloseHandle(pi.hProcess);
                    if (pi.hThread  != IntPtr.Zero) NativeMethods.CloseHandle(pi.hThread);
                }
                else
                {
                    Log("CreateProcessAsUser failed (Win32 error " +
                        Marshal.GetLastWin32Error().ToString() + ").");
                }

                return ok;
            }
            finally
            {
                if (envBlock     != IntPtr.Zero) NativeMethods.DestroyEnvironmentBlock(envBlock);
                if (primaryToken != IntPtr.Zero) NativeMethods.CloseHandle(primaryToken);
                if (userToken    != IntPtr.Zero) NativeMethods.CloseHandle(userToken);
            }
        }

        // ── Registry path resolution ───────────────────────────────────────
        private static string ResolveExePath()
        {
            using (RegistryKey key = Registry.LocalMachine.OpenSubKey(REG_KEY_HKLM))
            {
                if (key != null)
                {
                    string dir = key.GetValue(REG_INSTALL_PATH) as string;
                    if (!string.IsNullOrEmpty(dir))
                    {
                        string full = Path.Combine(dir, APP_EXE);
                        if (File.Exists(full)) return full;
                    }
                }
            }
            return null;
        }

        // ── Logging ────────────────────────────────────────────────────────
        private void Log(string message)
        {
            try
            {
                string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") +
                              " [Watchdog] " + message + Environment.NewLine;
                File.AppendAllText(_logPath, line);
            }
            catch { }
        }

        private void TrimLog()
        {
            try
            {
                if (!File.Exists(_logPath)) return;
                string[] lines = File.ReadAllLines(_logPath);
                if (lines.Length > 600)
                {
                    // Keep last 500 lines
                    string[] kept = new string[500];
                    Array.Copy(lines, lines.Length - 500, kept, 0, 500);
                    File.WriteAllLines(_logPath, kept);
                }
            }
            catch { }
        }

        // ── Entry point ────────────────────────────────────────────────────
        internal static void Main()
        {
            ServiceBase.Run(new WatchdogService());
        }
    }
}
