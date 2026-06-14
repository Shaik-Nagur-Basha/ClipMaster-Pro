import { app } from "electron";
import { exec } from "child_process";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

// ─── Task / Service names ────────────────────────────────────────────────────
const MANUAL_TASK = "ClipMasterProManualLaunch";
const AUTO_TASK   = "ClipMasterProAutoLaunch";
const SVC_NAME    = "ClipMasterProWatchdog";

// ─── Shared Task Scheduler settings object ───────────────────────────────────
// Applied to every task we create or repair so they are maximally resilient:
//  • StartWhenAvailable  — catch triggers that fired while the machine was off
//  • AllowStartIfOnBatteries / DontStopIfGoingOnBatteries — laptop support
//  • ExecutionTimeLimit 0 — never auto-terminate a long-running app
//  • MultipleInstances Parallel — allow the singleton-lock logic in main.ts
//    to handle concurrency rather than silently discarding a launch
function scheduledTaskSettings(): string {
  return [
    "New-ScheduledTaskSettingsSet",
    "-MultipleInstances Parallel",
    "-StartWhenAvailable",
    "-AllowStartIfOnBatteries",
    "-DontStopIfGoingOnBatteries",
    "-ExecutionTimeLimit ([System.TimeSpan]::Zero)",
  ].join(" ");
}

// ─── Helper: run a PowerShell command ────────────────────────────────────────
function runPS(command: string, label: string): void {
  exec(
    `powershell -NoProfile -NonInteractive -Command "${command}"`,
    (err, _stdout, stderr) => {
      if (err) {
        console.error(`[AutoLaunch] ${label} failed:`, err.message, stderr?.trim());
      } else {
        console.log(`[AutoLaunch] ${label} OK.`);
      }
    },
  );
}

// ─── Helper: get current username ────────────────────────────────────────────
function currentUsername(): string {
  // process.env.USERNAME is the fastest path; os.userInfo() is the fallback.
  return process.env.USERNAME || os.userInfo().username;
}

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Writes the app's installation directory to the registry so the watchdog
 * service can locate the executable after reboots, updates, and long
 * shutdowns — even when the app itself is not running.
 *
 * Writes to HKLM (requires admin; the app is already elevated).
 * Falls back silently if the write fails (previous HKLM value remains valid).
 */
export function writeInstallPathRegistry(installDir: string): void {
  if (process.platform !== "win32") return;

  // Escape any single quotes in the path (edge case, but safe).
  const safePath = installDir.replace(/'/g, "''");

  const ps = [
    `New-Item -Path 'HKLM:\\SOFTWARE\\ClipMaster Pro' -Force | Out-Null`,
    `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\ClipMaster Pro' -Name 'InstallPath' -Value '${safePath}'`,
    `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\ClipMaster Pro' -Name 'ExePath'      -Value '${safePath}\\ClipMaster Pro.exe'`,
  ].join("; ");

  exec(
    `powershell -NoProfile -NonInteractive -Command "${ps}"`,
    (err) => {
      if (err) {
        console.warn("[Registry] Failed to write HKLM InstallPath (non-fatal):", err.message);
      } else {
        console.log("[Registry] HKLM\\SOFTWARE\\ClipMaster Pro\\InstallPath written:", installDir);
      }
    },
  );
}

/**
 * Installs (or verifies) the ClipMaster Pro Watchdog Windows Service.
 *
 * The service (watchdog-service.exe) runs as LocalSystem and monitors the
 * active user session every 60 seconds. If the app is not running it
 * relaunches it via CreateProcessAsUser so clipboard monitoring is always
 * active regardless of startup method or power cycle history.
 *
 * Installation is idempotent — if the service is already registered, this
 * function simply ensures it is running.
 */
export function installWatchdogService(installDir: string): void {
  if (process.platform !== "win32" || !app.isPackaged) return;

  const svcExe = path.join(installDir, "watchdog-service.exe");
  if (!fs.existsSync(svcExe)) {
    console.warn("[Service] watchdog-service.exe not found at:", svcExe, "— skipping service install.");
    return;
  }

  // Check whether the service is already installed.
  exec(`sc query "${SVC_NAME}"`, (queryErr) => {
    if (!queryErr) {
      // Service exists. Just make sure it is running.
      exec(`sc start "${SVC_NAME}"`, () => {
        console.log("[Service] Watchdog service start requested (already installed).");
      });
      return;
    }

    // Service is not installed — create it.
    // Note: sc.exe requires   binPath= "<quoted path>"   (space after =, quoted path).
    const binPath  = svcExe.replace(/\\/g, "\\\\"); // double-escape for cmd.exe
    const createCmd = [
      `sc create "${SVC_NAME}"`,
      `binPath= "\\"${svcExe}\\""`,
      `DisplayName= "ClipMaster Pro Watchdog"`,
      `start= delayed-auto`,
      `obj= LocalSystem`,
    ].join(" ");

    exec(createCmd, (createErr, _stdout, createStderr) => {
      if (createErr) {
        console.error("[Service] Failed to create watchdog service:", createErr.message, createStderr?.trim());
        return;
      }

      console.log("[Service] Watchdog service created.");

      // Set description and failure-recovery actions (restart after 5s / 10s / 30s).
      exec(
        `sc description "${SVC_NAME}" "Keeps ClipMaster Pro clipboard manager running in the background."`,
        () => {},
      );
      exec(
        `sc failure "${SVC_NAME}" reset= 86400 actions= restart/5000/restart/10000/restart/30000`,
        () => {},
      );

      // Start the service immediately (it will also auto-start on next boot).
      exec(`sc start "${SVC_NAME}"`, (startErr) => {
        if (startErr) {
          console.warn("[Service] Could not start watchdog service right now (will start on next boot):", startErr.message);
        } else {
          console.log("[Service] Watchdog service started successfully.");
        }
      });
    });
  });
}

/**
 * Removes the HKCU Run registry key if it exists.
 *
 * We no longer use the HKCU Run key as an auto-start mechanism because it
 * launches the app as a standard user without preserving the --hidden flag,
 * which caused the main window to open on system startup. The Task Scheduler
 * AutoLaunch task (elevated, with --hidden) and the watchdog service cover
 * all startup scenarios reliably. This function cleans up the key from any
 * existing installs.
 */
function removeRegistryRunKey(): void {
  if (process.platform !== "win32") return;
  const ps = `Remove-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'ClipMaster Pro' -ErrorAction SilentlyContinue`;
  runPS(ps, "Remove HKCU Run key (cleanup)");
}

/**
 * Synchronizes the auto-launch state across three layers:
 *
 * Layer 1 — Task Scheduler (primary): ClipMasterProAutoLaunch
 *   Starts the app elevated (rl highest) on logon using the correct user
 *   principal (/ru <username>). This is the preferred path.
 *
 * Layer 2 — HKCU Registry Run key (fallback): starts the app hidden.
 *   Fires even when the Task Scheduler task is absent or disabled, giving
 *   the app a chance to self-elevate via the ManualLaunch task.
 *
 * Layer 3 — Watchdog Service (safety net): see installWatchdogService().
 *
 * Also always recreates the ManualLaunch task with the correct /ru so the
 * desktop shortcut (launcher.exe → schtasks /run ManualLaunch) never fails.
 *
 * The legacy Electron openAtLogin registry entry is removed to prevent
 * duplicate standard-user launches that conflict with Task Scheduler.
 */
export function syncAutoLaunch(enabled: boolean): void {
  if (process.platform !== "win32") return;

  const isPackaged = app.isPackaged;
  const username   = currentUsername();

  // ── 1. Remove legacy Electron openAtLogin to prevent duplicate launches ──
  try {
    app.setLoginItemSettings({
      openAtLogin: false,
      name: "ClipMaster Pro",
      path: app.getPath("exe"),
    });
  } catch (err) {
    console.error("[AutoLaunch] Error clearing legacy openAtLogin:", err);
  }

  if (!isPackaged) return; // Task Scheduler / registry changes are production-only.

  const exePath = app.getPath("exe");

  // ── 2. Remove the HKCU Run key from any existing installs ───────────────
  // The Run key is no longer used as an auto-start mechanism (see removeRegistryRunKey).
  // Always remove it so existing installs are cleaned up on next launch.
  removeRegistryRunKey();

  // ── 3. Always ensure the ManualLaunch task exists with correct /ru ───────
  // This task is triggered by launcher.exe (desktop/Start Menu shortcut) and
  // by the self-heal block in main.ts when the app starts without elevation.
  const manualCmd = [
    "schtasks /create",
    `/tn "${MANUAL_TASK}"`,
    `/tr "\\"${exePath}\\""`,
    "/sc once /sd 01/01/1910 /st 00:00",
    "/rl highest",
    `/ru "${username}"`,
    "/f",
  ].join(" ");

  exec(manualCmd, (err, _stdout, stderr) => {
    if (err) {
      console.error("[AutoLaunch] Error creating manual task:", err.message, stderr?.trim());
      return;
    }
    console.log("[AutoLaunch] ManualLaunch task created/updated with /ru:", username);
    const ps = `Set-ScheduledTask -TaskName '${MANUAL_TASK}' -Settings (${scheduledTaskSettings()})`;
    runPS(ps, `Apply settings to ${MANUAL_TASK}`);
    // Ensure the task is not in a Disabled state (Windows Update can disable tasks).
    exec(`schtasks /change /tn "${MANUAL_TASK}" /enable`, () => {});
  });

  // ── 4. Sync the AutoLaunch (onlogon) task ────────────────────────────────
  if (enabled) {
    const autoCmd = [
      "schtasks /create",
      `/tn "${AUTO_TASK}"`,
      `/tr "\\"${exePath}\\" --hidden"`,
      "/sc onlogon",
      "/rl highest",
      `/ru "${username}"`,
      "/f",
    ].join(" ");

    exec(autoCmd, (err, _stdout, stderr) => {
      if (err) {
        console.error("[AutoLaunch] Error creating auto-launch task:", err.message, stderr?.trim());
        return;
      }
      console.log("[AutoLaunch] AutoLaunch task created/updated with /ru:", username);
      const ps = `Set-ScheduledTask -TaskName '${AUTO_TASK}' -Settings (${scheduledTaskSettings()})`;
      runPS(ps, `Apply settings to ${AUTO_TASK}`);
      exec(`schtasks /change /tn "${AUTO_TASK}" /enable`, () => {});
    });
  } else {
    // Disable auto-launch: delete the Task Scheduler task.
    exec(`schtasks /delete /tn "${AUTO_TASK}" /f`, (err, _stdout, stderr) => {
      if (err) {
        const msg = stderr?.trim() ?? "";
        if (msg.includes("not find") || msg.includes("not exist")) {
          console.log("[AutoLaunch] AutoLaunch task was already absent — nothing to delete.");
        } else {
          console.error("[AutoLaunch] Error deleting auto-launch task:", err.message, msg);
        }
      } else {
        console.log("[AutoLaunch] AutoLaunch task deleted.");
      }
    });
  }
}

/**
 * Verifies that all ClipMaster Pro scheduled tasks exist and are healthy.
 * If a task is missing (deleted by Windows Update, AV software, user action,
 * or a long power-off cycle), it is recreated immediately with the correct
 * /ru principal so elevation and auto-launch resume without a reinstall.
 *
 * Called on every app startup from main.ts → app.whenReady().
 */
export function verifyAndRepairScheduledTasks(autoLaunchEnabled: boolean): void {
  if (process.platform !== "win32" || !app.isPackaged) return;

  const exePath  = app.getPath("exe");
  const username = currentUsername();

  // ── Verify ManualLaunch task ─────────────────────────────────────────────
  exec(`schtasks /query /tn "${MANUAL_TASK}" /fo LIST`, (err) => {
    if (err) {
      console.log(`[AutoLaunch] ${MANUAL_TASK} missing — recreating with /ru "${username}"...`);
      const cmd = [
        "schtasks /create",
        `/tn "${MANUAL_TASK}"`,
        `/tr "\\"${exePath}\\""`,
        "/sc once /sd 01/01/1910 /st 00:00",
        "/rl highest",
        `/ru "${username}"`,
        "/f",
      ].join(" ");
      exec(cmd, (createErr, _stdout, createStderr) => {
        if (createErr) {
          console.error("[AutoLaunch] Failed to recreate manual task:", createErr.message, createStderr?.trim());
        } else {
          console.log("[AutoLaunch] Manual task recreated successfully.");
          const ps = `Set-ScheduledTask -TaskName '${MANUAL_TASK}' -Settings (${scheduledTaskSettings()})`;
          runPS(ps, `Apply settings to repaired ${MANUAL_TASK}`);
          exec(`schtasks /change /tn "${MANUAL_TASK}" /enable`, () => {});
        }
      });
    } else {
      console.log(`[AutoLaunch] ${MANUAL_TASK} verified OK.`);
      // Re-enable in case Windows silently disabled it (happens after updates).
      exec(`schtasks /change /tn "${MANUAL_TASK}" /enable`, () => {});
    }
  });

  // ── Verify AutoLaunch task (only when auto-launch is enabled) ────────────
  if (autoLaunchEnabled) {
    exec(`schtasks /query /tn "${AUTO_TASK}" /fo LIST`, (err) => {
      if (err) {
        console.log(`[AutoLaunch] ${AUTO_TASK} missing — recreating with /ru "${username}"...`);
        const cmd = [
          "schtasks /create",
          `/tn "${AUTO_TASK}"`,
          `/tr "\\"${exePath}\\" --hidden"`,
          "/sc onlogon",
          "/rl highest",
          `/ru "${username}"`,
          "/f",
        ].join(" ");
        exec(cmd, (createErr, _stdout, createStderr) => {
          if (createErr) {
            console.error("[AutoLaunch] Failed to recreate auto-launch task:", createErr.message, createStderr?.trim());
          } else {
            console.log("[AutoLaunch] Auto-launch task recreated successfully.");
            const ps = `Set-ScheduledTask -TaskName '${AUTO_TASK}' -Settings (${scheduledTaskSettings()})`;
            runPS(ps, `Apply settings to repaired ${AUTO_TASK}`);
            exec(`schtasks /change /tn "${AUTO_TASK}" /enable`, () => {});
          }
        });
      } else {
        console.log(`[AutoLaunch] ${AUTO_TASK} verified OK.`);
        exec(`schtasks /change /tn "${AUTO_TASK}" /enable`, () => {});
      }
    });
  }
}
