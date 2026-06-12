import { app } from "electron";
import { exec } from "child_process";

/**
 * Synchronizes the auto-launch state using a Windows Task Scheduler task.
 * This runs the application elevated with Administrator privileges without a UAC prompt on logon.
 */
export function syncAutoLaunch(enabled: boolean): void {
  if (process.platform !== "win32") return;

  const autoTaskName = "ClipMasterProAutoLaunch";
  const manualTaskName = "ClipMasterProManualLaunch";
  const isPackaged = app.isPackaged;

  // 1. Clean up the standard registry login item to avoid UAC prompt conflicts or duplicate launch
  try {
    app.setLoginItemSettings({
      openAtLogin: false,
      name: "ClipMaster Pro",
      path: app.getPath("exe"),
    });
  } catch (err) {
    console.error("[AutoLaunch] Error clearing registry login items:", err);
  }

  // 2. Synchronize the manual-launch scheduled task (always needed for UAC-free shortcuts)
  if (isPackaged) {
    const exePath = app.getPath("exe");
    // Create or update manual task with highest privileges (/rl highest). Sc once set to past date.
    const manualCmd = `schtasks /create /tn "${manualTaskName}" /tr "\\"${exePath}\\"" /sc once /sd 01/01/1910 /st 00:00 /rl highest /f`;
    console.log(`[AutoLaunch] Syncing manual Task Scheduler task: ${manualCmd}`);
    exec(manualCmd, (err, stdout, stderr) => {
      if (err) {
        console.error("[AutoLaunch] Error creating manual scheduled task:", err, stderr);
      } else {
        console.log("[AutoLaunch] Manual scheduled task synced successfully:", stdout.trim());
      }
    });
  }

  // 3. Synchronize the auto-launch scheduled task
  if (enabled && isPackaged) {
    const exePath = app.getPath("exe");
    // Create or update auto task with highest privileges (/rl highest) triggered on logon (/sc onlogon)
    const autoCmd = `schtasks /create /tn "${autoTaskName}" /tr "\\"${exePath}\\" --hidden" /sc onlogon /rl highest /f`;
    console.log(`[AutoLaunch] Enabling auto Task Scheduler task: ${autoCmd}`);
    exec(autoCmd, (err, stdout, stderr) => {
      if (err) {
        console.error("[AutoLaunch] Error creating auto scheduled task:", err, stderr);
      } else {
        console.log("[AutoLaunch] Auto scheduled task created successfully:", stdout.trim());
      }
    });
  } else {
    // Delete auto-start scheduled task
    const autoCmd = `schtasks /delete /tn "${autoTaskName}" /f`;
    console.log(`[AutoLaunch] Disabling/deleting auto Task Scheduler task: ${autoCmd}`);
    exec(autoCmd, (err, stdout, stderr) => {
      if (err) {
        // Suppress warn if the task didn't exist in the first place
        if (stderr && (stderr.includes("not find") || stderr.includes("not exist"))) {
          console.log("[AutoLaunch] Auto scheduled task did not exist (already deleted/disabled).");
        } else {
          console.error("[AutoLaunch] Error deleting auto scheduled task:", err, stderr);
        }
      } else {
        console.log("[AutoLaunch] Auto scheduled task deleted successfully:", stdout.trim());
      }
    });
  }
}
