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
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

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
