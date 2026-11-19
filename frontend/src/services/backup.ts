/**
 * Export / Restore for the phone app.
 *
 * A backup is one JSON file holding everything (tasks, notes, events, name).
 * On Android the system file picker chooses where it goes (Downloads, Drive,
 * …); in the browser preview it downloads / uploads a file instead.
 */
import { IS_ANDROID } from "../lib/platform";
import { exportData, importData } from "./localBackend";
import type { StoreData } from "./localStore";
import type { BackupFile } from "./backupFormat";

export { parseBackup, summarize, type BackupSummary } from "./backupFormat";

function fileName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `DevTrack-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

/** Saves a backup. Returns false if the person cancelled the file picker. */
export async function exportBackup(): Promise<boolean> {
  const file: BackupFile = {
    app: "DevTrack",
    kind: "backup",
    format: 1,
    exported_at: new Date().toISOString(),
    data: await exportData(),
  };
  const text = JSON.stringify(file, null, 2);

  if (IS_ANDROID) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: fileName(), filters: [{ name: "DevTrack backup", extensions: ["json"] }] });
    if (!path) return false;
    await writeTextFile(path, text);
    setLastBackup(file.exported_at);
    return true;
  }

  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setLastBackup(file.exported_at);
  return true;
}

/** Lets the person pick a backup file and returns its text (null if cancelled). */
export async function pickBackup(): Promise<string | null> {
  if (IS_ANDROID) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({ multiple: false, directory: false, filters: [{ name: "DevTrack backup", extensions: ["json"] }] });
    if (!path || Array.isArray(path)) return null;
    return readTextFile(path);
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      f.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

/** Replaces everything on this phone with the backup's data. */
export function restoreBackup(data: StoreData): Promise<void> {
  return importData(data);
}

const LAST_BACKUP_KEY = "devtrack.last-backup";

/** When this phone last exported a backup (ISO time), if known. */
export function getLastBackup(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

export function setLastBackup(iso: string): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, iso);
  } catch {
    // ignore
  }
}
