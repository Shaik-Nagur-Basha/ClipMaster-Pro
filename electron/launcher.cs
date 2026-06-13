using System.Diagnostics;

class Launcher {
    static void Main() {
        ProcessStartInfo startInfo = new ProcessStartInfo();
        startInfo.FileName = "schtasks.exe";
        startInfo.Arguments = "/run /tn \"ClipMasterProManualLaunch\"";
        startInfo.CreateNoWindow = true;
        startInfo.UseShellExecute = false;
        Process.Start(startInfo);
    }
}
