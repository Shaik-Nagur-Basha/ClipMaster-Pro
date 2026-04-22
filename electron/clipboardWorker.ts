import { clipboard } from "electron";
import { parentPort } from "worker_threads";

const POLL_INTERVAL_MS = 600;
let lastText = "";

function pollClipboard(): void {
  try {
    const current = clipboard.readText() ?? "";
    if (!current.trim() || current === lastText) return;
    lastText = current;
    parentPort?.postMessage({ text: current });
  } catch {
    /* ignore worker clipboard failures */
  }
}

const timer = setInterval(pollClipboard, POLL_INTERVAL_MS);
pollClipboard();

parentPort?.on("message", (message) => {
  if (message === "stop") {
    clearInterval(timer);
    parentPort?.close();
    process.exit(0);
  }
});
