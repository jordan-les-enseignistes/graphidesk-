// Version actuelle de l'application (depuis tauri.conf.json)
const CURRENT_VERSION = "1.0.4";

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  changelog: string | null;
  isMandatory: boolean;
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}
