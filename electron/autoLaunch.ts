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
    // Points directly to exePath to avoid flashing a console window.
    const manualCmd = `schtasks /create /tn "${manualTaskName}" /tr "\\"${exePath}\\"" /sc once /sd 01/01/1910 /st 00:00 /rl highest /f`;
    console.log(`[AutoLaunch] Syncing manual Task Scheduler task: ${manualCmd}`);
    exec(manualCmd, (err, stdout, stderr) => {
      if (err) {
        console.error("[AutoLaunch] Error creating manual scheduled task:", err, stderr);
      } else {
        console.log("[AutoLaunch] Manual scheduled task created. Setting policy to Parallel...");
        // Configure MultipleInstancesPolicy to Parallel to allow multiple launches to run & notify single-instance lock
        exec(`powershell -Command "Set-ScheduledTask -TaskName '${manualTaskName}' -Settings (New-ScheduledTaskSettingsSet -MultipleInstances Parallel)"`, (psErr) => {
          if (psErr) {
            console.error("[AutoLaunch] Error setting manual task to Parallel:", psErr);
          } else {
            console.log("[AutoLaunch] Manual scheduled task policy set to Parallel successfully.");
          }
        });
      }
    });
  }

  // 3. Synchronize the auto-launch scheduled task
  if (enabled && isPackaged) {
    const exePath = app.getPath("exe");
    // Create or update auto task with highest privileges (/rl highest) triggered on logon (/sc onlogon)
    // Points directly to exePath to avoid flashing a console window.
    const autoCmd = `schtasks /create /tn "${autoTaskName}" /tr "\\"${exePath}\\" --hidden" /sc onlogon /rl highest /f`;
    console.log(`[AutoLaunch] Enabling auto Task Scheduler task: ${autoCmd}`);
    exec(autoCmd, (err, stdout, stderr) => {
      if (err) {
        console.error("[AutoLaunch] Error creating auto scheduled task:", err, stderr);
      } else {
        console.log("[AutoLaunch] Auto scheduled task created. Setting policy to Parallel...");
        // Configure MultipleInstancesPolicy to Parallel
        exec(`powershell -Command "Set-ScheduledTask -TaskName '${autoTaskName}' -Settings (New-ScheduledTaskSettingsSet -MultipleInstances Parallel)"`, (psErr) => {
          if (psErr) {
            console.error("[AutoLaunch] Error setting auto task to Parallel:", psErr);
          } else {
            console.log("[AutoLaunch] Auto scheduled task policy set to Parallel successfully.");
          }
        });
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

/**
 * Verifies that the ClipMaster Pro scheduled tasks exist and are healthy.
 * If the manual-launch task is missing (deleted by Windows Update, user, or
 * a previous clear-cache), it is recreated immediately so elevation continues
 * to work without requiring a reinstall.
 *
 * Called on every app startup and after Advanced Clear Cache.
 */
export function verifyAndRepairScheduledTasks(autoLaunchEnabled: boolean): void {
  if (process.platform !== "win32" || !app.isPackaged) return;

  const manualTaskName = "ClipMasterProManualLaunch";
  const autoTaskName = "ClipMasterProAutoLaunch";
  const exePath = app.getPath("exe");

  // Check if the manual-launch task exists
  exec(`schtasks /query /tn "${manualTaskName}" /fo LIST`, (err) => {
    if (err) {
      // Task is missing — recreate it
      console.log(`[AutoLaunch] Manual task '${manualTaskName}' not found. Recreating...`);
      const manualCmd = `schtasks /create /tn "${manualTaskName}" /tr "\\"${exePath}\\"" /sc once /sd 01/01/1910 /st 00:00 /rl highest /f`;
      exec(manualCmd, (createErr, _stdout, createStderr) => {
        if (createErr) {
          console.error(`[AutoLaunch] Failed to recreate manual task:`, createErr, createStderr);
        } else {
          console.log(`[AutoLaunch] Manual task recreated successfully.`);
          exec(
            `powershell -Command "Set-ScheduledTask -TaskName '${manualTaskName}' -Settings (New-ScheduledTaskSettingsSet -MultipleInstances Parallel)"`,
            (psErr) => {
              if (psErr) {
                console.error("[AutoLaunch] Error setting repaired manual task to Parallel:", psErr);
              } else {
                console.log("[AutoLaunch] Repaired manual task policy set to Parallel.");
              }
            }
          );
        }
      });
    } else {
      console.log(`[AutoLaunch] Manual task '${manualTaskName}' verified OK.`);
    }
  });

  // Check the auto-launch task only if auto-launch is enabled
  if (autoLaunchEnabled) {
    exec(`schtasks /query /tn "${autoTaskName}" /fo LIST`, (err) => {
      if (err) {
        console.log(`[AutoLaunch] Auto-launch task '${autoTaskName}' not found. Recreating...`);
        const autoCmd = `schtasks /create /tn "${autoTaskName}" /tr "\\"${exePath}\\" --hidden" /sc onlogon /rl highest /f`;
        exec(autoCmd, (createErr, _stdout, createStderr) => {
          if (createErr) {
            console.error(`[AutoLaunch] Failed to recreate auto-launch task:`, createErr, createStderr);
          } else {
            console.log(`[AutoLaunch] Auto-launch task recreated successfully.`);
            exec(
              `powershell -Command "Set-ScheduledTask -TaskName '${autoTaskName}' -Settings (New-ScheduledTaskSettingsSet -MultipleInstances Parallel)"`,
              (psErr) => {
                if (psErr) {
                  console.error("[AutoLaunch] Error setting repaired auto-launch task to Parallel:", psErr);
                } else {
                  console.log("[AutoLaunch] Repaired auto-launch task policy set to Parallel.");
                }
              }
            );
          }
        });
      } else {
        console.log(`[AutoLaunch] Auto-launch task '${autoTaskName}' verified OK.`);
      }
    });
  }
}
