import { config } from "../../package.json";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_PREFIX = `[${config.addonName}]`;

// Declare globals
declare const Zotero: any;

/**
 * Get console from main window (like ztoolkit does)
 */
function getConsole(): Console | null {
  try {
    if (typeof Zotero !== "undefined") {
      const win = Zotero.getMainWindow?.();
      if (win?.console) {
        return win.console;
      }
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

/**
 * Log a message with a specific level
 * Uses main window console (like ztoolkit) + Zotero.debug
 */
export function log(level: LogLevel, ...args: any[]): void {
  const message = `${LOG_PREFIX} [${level.toUpperCase()}] ${args.join(" ")}`;

  // Use main window console (this shows in Browser Console)
  const console = getConsole();
  if (console) {
    switch (level) {
      case "error":
        console.error(message);
        break;
      case "warn":
        console.warn(message);
        break;
      case "debug":
        console.debug(message);
        break;
      default:
        console.log(message);
    }
  }

  // Also use Zotero.debug for debug output logging
  if (typeof Zotero !== "undefined" && Zotero.debug) {
    Zotero.debug(message);
  }

  // Log errors to Zotero's error log
  if (level === "error" && typeof Zotero !== "undefined" && Zotero.logError) {
    Zotero.logError(new Error(args.join(" ")));
  }
}

/**
 * Quick log to console - use for debugging
 */
export function ztLog(message: string): void {
  const console = getConsole();
  if (console) {
    console.log(message);
  }
  if (typeof Zotero !== "undefined" && Zotero.debug) {
    Zotero.debug(message);
  }
}

export const logger = {
  debug: (...args: any[]) => log("debug", ...args),
  info: (...args: any[]) => log("info", ...args),
  warn: (...args: any[]) => log("warn", ...args),
  error: (...args: any[]) => log("error", ...args),
};

export default logger;
