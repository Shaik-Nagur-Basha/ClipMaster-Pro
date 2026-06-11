using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;
using System.Threading;

public class Program {
    [DllImport("user32.dll")]
    private static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

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

    private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_TOPMOST = 0x00000008;
    private const int WS_EX_NOACTIVATE = 0x08000000;

    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_SHOWWINDOW = 0x0040;

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

    private const uint GW_HWNDNEXT = 2;

    [STAThread]
    public static void Main(string[] args) {
        int delay = 50;
        IntPtr popupHwnd = IntPtr.Zero;
        uint ownPid = 0;

        if (args.Length > 0) {
            long val = 0;
            if (long.TryParse(args[0], out val)) {
                popupHwnd = new IntPtr(val);
            }
        }
        if (args.Length > 1 && args[1] == "topmost") {
            if (popupHwnd != IntPtr.Zero) {
                try {
                    IntPtr exStyle = GetWindowLongPtr(popupHwnd, GWL_EXSTYLE);
                    long newExStyle = exStyle.ToInt64() | WS_EX_TOPMOST | WS_EX_NOACTIVATE;
                    SetWindowLongPtr(popupHwnd, GWL_EXSTYLE, new IntPtr(newExStyle));

                    SetWindowPos(popupHwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                    Console.WriteLine("TOPMOST_SUCCESS");

                    // Keep enforcing HWND_TOPMOST Z-order periodically while the window is valid
                    // to prevent Z-order competition and keep it topmost during drag/move.
                    while (true) {
                        Thread.Sleep(50);
                        if (!IsWindow(popupHwnd)) {
                            break;
                        }
                        SetWindowPos(popupHwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
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
        if (args.Length > 1) {
            uint p = 0;
            if (uint.TryParse(args[1], out p)) {
                ownPid = p;
            }
        }
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

        // Find the previously active window in Z-order
        IntPtr targetHwnd = IntPtr.Zero;
        if (popupHwnd != IntPtr.Zero) {
            IntPtr next = GetWindow(popupHwnd, GW_HWNDNEXT);
            while (next != IntPtr.Zero) {
                if (IsWindowVisible(next)) {
                    uint windowPid = 0;
                    GetWindowThreadProcessId(next, out windowPid);
                    
                    if (ownPid == 0 || windowPid != ownPid) {
                        StringBuilder title = new StringBuilder(256);
                        GetWindowText(next, title, 256);
                        string titleStr = title.ToString().Trim();
                        
                        // Filter out empty titles, system shells, and program manager
                        if (!string.IsNullOrEmpty(titleStr) && 
                            titleStr != "Program Manager" && 
                            titleStr != "Start" && 
                            titleStr != "Windows Input Experience") {
                            targetHwnd = next;
                            break;
                        }
                    }
                }
                next = GetWindow(next, GW_HWNDNEXT);
            }
        }

        if (targetHwnd != IntPtr.Zero) {
            SetForegroundWindow(targetHwnd);
        }
        Console.WriteLine("READY_TO_CLOSE");

        Thread.Sleep(delay);
        SendKeys.SendWait("^v");

        if (shouldRefocus && popupHwnd != IntPtr.Zero) {
            Thread.Sleep(50);
            SetForegroundWindow(popupHwnd);
        }
    }
}
