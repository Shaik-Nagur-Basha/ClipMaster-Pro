using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;
using System.Threading;

public class Program {
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr", SetLastError = true)]
    private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr", SetLastError = true)]
    private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    private static extern IntPtr WindowFromPoint(long point);

    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr hwnd, uint gaFlags);

    private const uint GA_ROOT = 2;
    private const uint GA_ROOTOWNER = 3;

    [DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint processAccess, bool bInheritHandle, uint processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr hObject);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern short GetKeyState(int nVirtKey);

    [DllImport("user32.dll")]
    private static extern int ToUnicode(uint wVirtKey, uint wScanCode, byte[] lpKeyState, [Out, MarshalAs(UnmanagedType.LPWStr, SizeConst = 64)] StringBuilder pwszBuff, int cchBuff, uint wFlags);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
    private static LowLevelKeyboardProc _proc;
    private static IntPtr _hookID = IntPtr.Zero;
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;

    private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);
    private static LowLevelMouseProc _mouseProc;
    private static IntPtr _mouseHookID = IntPtr.Zero;
    private const int WH_MOUSE_LL = 14;
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_RBUTTONDOWN = 0x0204;
    private const int WM_MBUTTONDOWN = 0x0207;

    private static IntPtr _popupHwnd = IntPtr.Zero;
    private static volatile bool _keyboardHookEnabled = false;

    [StructLayout(LayoutKind.Sequential)]
    private struct KBDLLHOOKSTRUCT {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT {
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MSLLHOOKSTRUCT {
        public POINT pt;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    private const uint PROCESS_QUERY_INFORMATION = 0x0400;

    private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_TOPMOST = 0x00000008;
    private const int WS_EX_NOACTIVATE = 0x08000000;

    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOACTIVATE = 0x0010;

    private const byte VK_CONTROL = 0x11;
    private const byte VK_V = 0x56;
    private const byte VK_MENU = 0x12;
    private const uint KEYEVENTF_KEYUP = 0x0002;

    private static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex) {
        if (IntPtr.Size == 8) {
            return GetWindowLongPtr64(hWnd, nIndex);
        } else {
            return new IntPtr(GetWindowLong(hWnd, nIndex));
        }
    }

    private static IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong) {
        if (IntPtr.Size == 8) {
            return SetWindowLongPtr64(hWnd, nIndex, dwNewLong);
        } else {
            return new IntPtr(SetWindowLong(hWnd, nIndex, dwNewLong.ToInt32()));
        }
    }

    private static string GetCharsFromKeys(uint vkCode, uint scanCode) {
        StringBuilder sb = new StringBuilder();
        byte[] keyboardState = new byte[256];
        
        if ((GetKeyState(0x10) & 0x8000) != 0) keyboardState[0x10] = 0x80; // Shift
        if ((GetKeyState(0x11) & 0x8000) != 0) keyboardState[0x11] = 0x80; // Control
        if ((GetKeyState(0x12) & 0x8000) != 0) keyboardState[0x12] = 0x80; // Alt
        if ((GetKeyState(0x14) & 0x0001) != 0) keyboardState[0x14] = 0x01; // Caps Lock
        
        int result = ToUnicode(vkCode, scanCode, keyboardState, sb, 5, 0);
        if (result > 0) {
            return sb.ToString();
        }
        return null;
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (!_keyboardHookEnabled) {
            return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }
        if (nCode >= 0 && wParam == (IntPtr)WM_KEYDOWN) {
            KBDLLHOOKSTRUCT kb = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
            
            bool isCtrl = (GetKeyState(0x11) & 0x8000) != 0;
            bool isAlt = (GetKeyState(0x12) & 0x8000) != 0 || (kb.flags & 0x20) != 0;
            bool isWin = (GetKeyState(0x5B) & 0x8000) != 0 || (GetKeyState(0x5C) & 0x8000) != 0;

            if (isWin || isAlt) {
                return CallNextHookEx(_hookID, nCode, wParam, lParam);
            }

            uint vk = kb.vkCode;
            
            if (isCtrl) {
                string ctrlKey = null;
                if (vk == 0x41) ctrlKey = "Ctrl+A";
                else if (vk == 0x43) ctrlKey = "Ctrl+C";
                else if (vk == 0x56) ctrlKey = "Ctrl+V";
                else if (vk == 0x58) ctrlKey = "Ctrl+X";
                else if (vk == 0x5A) ctrlKey = "Ctrl+Z";

                if (ctrlKey != null) {
                    Console.WriteLine("KEY:" + ctrlKey);
                    return new IntPtr(1);
                }
                return CallNextHookEx(_hookID, nCode, wParam, lParam);
            }

            string specialKey = null;
            if (vk == 0x08) specialKey = "Backspace";
            else if (vk == 0x2E) specialKey = "Delete";
            else if (vk == 0x25) specialKey = "Left";
            else if (vk == 0x27) specialKey = "Right";
            else if (vk == 0x26) specialKey = "Up";
            else if (vk == 0x28) specialKey = "Down";
            else if (vk == 0x0D) specialKey = "Enter";
            else if (vk == 0x1B) specialKey = "Escape";
            else if (vk == 0x09) specialKey = "Tab";
            else if (vk == 0x24) specialKey = "Home";
            else if (vk == 0x23) specialKey = "End";

            if (specialKey != null) {
                Console.WriteLine("KEY:" + specialKey);
                return new IntPtr(1);
            }

            string chars = GetCharsFromKeys(vk, kb.scanCode);
            if (chars != null && chars.Length > 0) {
                Console.WriteLine("CHAR:" + chars);
                return new IntPtr(1);
            }
        }
        return CallNextHookEx(_hookID, nCode, wParam, lParam);
    }

    private static IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0 && (wParam == (IntPtr)WM_LBUTTONDOWN || wParam == (IntPtr)WM_RBUTTONDOWN || wParam == (IntPtr)WM_MBUTTONDOWN)) {
            MSLLHOOKSTRUCT ms = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
            if (_popupHwnd != IntPtr.Zero && IsWindow(_popupHwnd)) {
                long pointAsLong = ((long)ms.pt.y << 32) | (ms.pt.x & 0xFFFFFFFFL);
                IntPtr clickedHwnd = WindowFromPoint(pointAsLong);
                if (clickedHwnd != IntPtr.Zero) {
                    IntPtr rootHwnd = GetAncestor(clickedHwnd, GA_ROOT);
                    IntPtr rootOwnerHwnd = GetAncestor(clickedHwnd, GA_ROOTOWNER);
                    Console.WriteLine(string.Format("DEBUG_MOUSE: pt={0},{1} hwnd={2} root={3} owner={4} popup={5}", 
                        ms.pt.x, ms.pt.y, clickedHwnd.ToInt64(), rootHwnd.ToInt64(), rootOwnerHwnd.ToInt64(), _popupHwnd.ToInt64()));
                    if (rootHwnd != _popupHwnd && rootOwnerHwnd != _popupHwnd && clickedHwnd != _popupHwnd) {
                        _keyboardHookEnabled = false;
                        Console.WriteLine("CLICK_OUTSIDE");
                    }
                } else {
                    // Fallback to coordinates check if WindowFromPoint returns Zero
                    RECT rect;
                    if (GetWindowRect(_popupHwnd, out rect)) {
                        int x = ms.pt.x;
                        int y = ms.pt.y;
                        Console.WriteLine(string.Format("DEBUG_MOUSE_RECT: pt={0},{1} rect={2},{3},{4},{5}", 
                            x, y, rect.Left, rect.Top, rect.Right, rect.Bottom));
                        if (x < rect.Left || x > rect.Right || y < rect.Top || y > rect.Bottom) {
                            _keyboardHookEnabled = false;
                            Console.WriteLine("CLICK_OUTSIDE");
                        }
                    }
                }
            }
        }
        return CallNextHookEx(_mouseHookID, nCode, wParam, lParam);
    }

    private static bool ForceForeground(IntPtr hWnd) {
        IntPtr currentFore = GetForegroundWindow();
        Console.WriteLine("ForceForeground target=" + hWnd.ToInt64() + " currentFore=" + currentFore.ToInt64());
        if (currentFore == hWnd) {
            Console.WriteLine("ForceForeground: already foreground");
            return true;
        }

        uint myThread = GetCurrentThreadId();
        uint foreThread = 0;
        uint dummyPid = 0;
        if (currentFore != IntPtr.Zero) {
            foreThread = GetWindowThreadProcessId(currentFore, out dummyPid);
        }
        uint targetThread = GetWindowThreadProcessId(hWnd, out dummyPid);

        bool attached1 = false;
        bool attached2 = false;

        if (foreThread != 0 && foreThread != myThread) {
            attached1 = AttachThreadInput(myThread, foreThread, true);
        }
        if (targetThread != myThread && targetThread != foreThread) {
            attached2 = AttachThreadInput(myThread, targetThread, true);
        }

        // Press Alt key to bypass Windows focus-stealing prevention
        keybd_event(VK_MENU, 0, 0, 0);
        bool result = SetForegroundWindow(hWnd);
        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
        
        Console.WriteLine("ForceForeground: SetForegroundWindow result=" + result);

        if (attached1) AttachThreadInput(myThread, foreThread, false);
        if (attached2) AttachThreadInput(myThread, targetThread, false);

        return result;
    }

    [STAThread]
    public static void Main(string[] args) {
        try {
            SetProcessDPIAware();
        } catch { }

        if (args.Length > 0 && args[0] == "get-foreground") {
            IntPtr active = GetForegroundWindow();
            Console.WriteLine(active.ToInt64().ToString());
            return;
        }

        if (args.Length > 1 && args[1] == "refocus") {
            IntPtr refocusHwnd = IntPtr.Zero;
            long targetVal = 0;
            if (long.TryParse(args[0], out targetVal)) {
                refocusHwnd = new IntPtr(targetVal);
            }
            if (refocusHwnd != IntPtr.Zero) {
                ForceForeground(refocusHwnd);
                Console.WriteLine("REFOCUS_SUCCESS");
            }
            return;
        }

        IntPtr popupHwnd = IntPtr.Zero;
        if (args.Length > 0) {
            long val = 0;
            if (long.TryParse(args[0], out val)) {
                popupHwnd = new IntPtr(val);
                _popupHwnd = popupHwnd;
            }
        }

        if (args.Length > 1 && args[1] == "hook") {
            try {
                _proc = HookCallback;
                _mouseProc = MouseHookCallback;
                using (System.Diagnostics.Process curProcess = System.Diagnostics.Process.GetCurrentProcess())
                using (System.Diagnostics.ProcessModule curModule = curProcess.MainModule) {
                    _hookID = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(curModule.ModuleName), 0);
                    _mouseHookID = SetWindowsHookEx(WH_MOUSE_LL, _mouseProc, GetModuleHandle(curModule.ModuleName), 0);
                }

                if (_hookID == IntPtr.Zero || _mouseHookID == IntPtr.Zero) {
                    Console.WriteLine("ERROR_HOOK_FAILED");
                    return;
                }

                Console.WriteLine("HOOK_SUCCESS");

                // Start background thread to read from stdin
                Thread stdinThread = new Thread(ReadStdin);
                stdinThread.IsBackground = true;
                stdinThread.Start();

                Application.Run();
            } finally {
                if (_hookID != IntPtr.Zero) {
                    UnhookWindowsHookEx(_hookID);
                }
                if (_mouseHookID != IntPtr.Zero) {
                    UnhookWindowsHookEx(_mouseHookID);
                }
            }
            return;
        }

        if (args.Length > 1 && args[1] == "topmost") {
            if (popupHwnd != IntPtr.Zero) {
                try {
                    IntPtr exStyle = GetWindowLongPtr(popupHwnd, GWL_EXSTYLE);
                    long newExStyle = exStyle.ToInt64() | WS_EX_TOPMOST | WS_EX_NOACTIVATE;
                    SetWindowLongPtr(popupHwnd, GWL_EXSTYLE, new IntPtr(newExStyle));

                    SetWindowPos(popupHwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                    Console.WriteLine("TOPMOST_SUCCESS");

                    while (true) {
                        Thread.Sleep(500);
                        if (!IsWindow(popupHwnd)) break;
                    }
                } catch (Exception ex) {
                    Console.WriteLine("ERROR_TOPMOST: " + ex.Message);
                }
            }
            return;
        }
        if (args.Length > 1 && args[1] == "noactivate") {
            if (popupHwnd != IntPtr.Zero) {
                try {
                    IntPtr exStyle = GetWindowLongPtr(popupHwnd, GWL_EXSTYLE);
                    long newExStyle = exStyle.ToInt64() | WS_EX_NOACTIVATE;
                    SetWindowLongPtr(popupHwnd, GWL_EXSTYLE, new IntPtr(newExStyle));
                    SetWindowPos(popupHwnd, IntPtr.Zero, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | 0x0200);
                    Console.WriteLine("NOACTIVATE_SUCCESS");
                } catch (Exception ex) {
                    Console.WriteLine("ERROR_NOACTIVATE: " + ex.Message);
                }
            }
            return;
        }
        if (args.Length > 1 && args[1] == "focusable") {
            if (popupHwnd != IntPtr.Zero) {
                try {
                    IntPtr exStyle = GetWindowLongPtr(popupHwnd, GWL_EXSTYLE);
                    long newExStyle = exStyle.ToInt64() & ~WS_EX_NOACTIVATE;
                    SetWindowLongPtr(popupHwnd, GWL_EXSTYLE, new IntPtr(newExStyle));
                    SetWindowPos(popupHwnd, IntPtr.Zero, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | 0x0200);
                    Console.WriteLine("FOCUSABLE_SUCCESS");
                } catch (Exception ex) {
                    Console.WriteLine("ERROR_FOCUSABLE: " + ex.Message);
                }
            }
            return;
        }

        // ── Paste command: args = [popupHwnd] [targetHwnd] [delay] [shouldRefocus]
        IntPtr targetHwnd = IntPtr.Zero;
        if (args.Length > 1) {
            long targetVal = 0;
            if (long.TryParse(args[1], out targetVal)) {
                targetHwnd = new IntPtr(targetVal);
            }
        }

        if (targetHwnd != IntPtr.Zero && !IsCurrentProcessElevated()) {
            uint targetPid = 0;
            GetWindowThreadProcessId(targetHwnd, out targetPid);
            if (targetPid != 0) {
                IntPtr hProcess = OpenProcess(PROCESS_QUERY_INFORMATION, false, targetPid);
                if (hProcess == IntPtr.Zero) {
                    int error = Marshal.GetLastWin32Error();
                    if (error == 5) { // ERROR_ACCESS_DENIED
                        Console.WriteLine("UAC_ELEVATION_BLOCKED");
                    }
                } else {
                    CloseHandle(hProcess);
                }
            }
        }

        int delay = 50;
        if (args.Length > 2) {
            int d = 50;
            if (int.TryParse(args[2], out d)) {
                delay = d;
            }
        }

        bool shouldRefocus = false;
        if (args.Length > 3) {
            shouldRefocus = args[3] == "1";
        }

        // Step 1: Ensure target window is foreground using thread-attach trick
        if (targetHwnd != IntPtr.Zero) {
            ForceForeground(targetHwnd);
        }

        Thread.Sleep(delay);

        // Step 2: Simulate Ctrl+V via keybd_event
        keybd_event(VK_CONTROL, 0, 0, 0);
        Thread.Sleep(5);
        keybd_event(VK_V, 0, 0, 0);
        Thread.Sleep(5);
        keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
        Thread.Sleep(5);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);

        // Step 3: Wait for the paste to be processed by the target, then re-assert focus
        Thread.Sleep(50);
        if (targetHwnd != IntPtr.Zero) {
            ForceForeground(targetHwnd);
        }

        // Step 4: Signal that paste is complete and it's safe to hide the popup
        Console.WriteLine("PASTE_DONE");

        if (shouldRefocus && popupHwnd != IntPtr.Zero) {
            Thread.Sleep(50);
            SetForegroundWindow(popupHwnd);
        }
    }

    private static bool IsCurrentProcessElevated() {
        using (var identity = System.Security.Principal.WindowsIdentity.GetCurrent()) {
            var principal = new System.Security.Principal.WindowsPrincipal(identity);
            return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
        }
    }

    private static void ReadStdin() {
        string line;
        while ((line = Console.ReadLine()) != null) {
            line = line.Trim();
            if (line == "ENABLE_KEYBOARD") {
                _keyboardHookEnabled = true;
            } else if (line == "DISABLE_KEYBOARD") {
                _keyboardHookEnabled = false;
            }
        }
    }
}
