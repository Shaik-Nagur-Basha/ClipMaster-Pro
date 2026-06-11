using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class ClipboardListenerForm : Form {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool AddClipboardFormatListener(IntPtr hwnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool RemoveClipboardFormatListener(IntPtr hwnd);

    private const int WM_CLIPBOARDUPDATE = 0x031D;

    public ClipboardListenerForm() {
        // Create the window handle in memory (no visible window is created)
        this.CreateHandle();
        bool success = AddClipboardFormatListener(this.Handle);
        if (!success) {
            Console.WriteLine("ERROR_REGISTER_LISTENER");
            Application.Exit();
        }
    }

    protected override void WndProc(ref Message m) {
        if (m.Msg == WM_CLIPBOARDUPDATE) {
            Console.WriteLine("CLIPBOARD_CHANGED");
        }
        base.WndProc(ref m);
    }

    protected override void Dispose(bool disposing) {
        RemoveClipboardFormatListener(this.Handle);
        base.Dispose(disposing);
    }
}

public class Program {
    [STAThread]
    public static void Main() {
        Application.Run(new ClipboardListenerForm());
    }
}
