import { config } from "../../package.json";

export function initLocale() {
  const l10n = new Localization([`${config.addonRef}-addon.ftl`], true);
  addon.data.locale = {
    current: l10n,
  };
}

export function getString(
  localID: string,
  options?: { branch?: string; args?: Record<string, unknown> }
): string {
  const { branch, args } = options || {};
  const id = `${config.addonRef}-${localID}`;

  // Get the message synchronously
  const message = addon.data.locale?.current?.formatValueSync(
    branch ? `${id}.${branch}` : id,
    args
  );

  return message || localID;
}

export function getLocaleID(localID: string): string {
  return `${config.addonRef}-${localID}`;
}
