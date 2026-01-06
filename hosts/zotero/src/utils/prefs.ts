import { config } from "../../package.json";

const PREFS_PREFIX = config.prefsPrefix;

/**
 * Get a preference value
 */
export function getPref<T = any>(key: string, defaultValue?: T): T {
  const fullKey = `${PREFS_PREFIX}.${key}`;
  const value = Zotero.Prefs.get(fullKey, true);
  return (value !== undefined ? value : defaultValue) as T;
}

/**
 * Set a preference value
 */
export function setPref<T>(key: string, value: T): void {
  const fullKey = `${PREFS_PREFIX}.${key}`;
  Zotero.Prefs.set(fullKey, value, true);
}

/**
 * Clear a preference
 */
export function clearPref(key: string): void {
  const fullKey = `${PREFS_PREFIX}.${key}`;
  Zotero.Prefs.clear(fullKey, true);
}

/**
 * Get all preferences with a prefix
 */
export function getAllPrefs(): Record<string, any> {
  const result: Record<string, any> = {};
  const branch = Services.prefs.getBranch(`${PREFS_PREFIX}.`);
  const children = branch.getChildList("");
  for (const child of children) {
    result[child] = getPref(child);
  }
  return result;
}
