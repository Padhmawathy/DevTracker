/** The backup file format. Pure (no I/O) so it can be unit-tested. */
import { normalizeStore, type StoreData } from "./localStore.ts";

export interface BackupFile {
  app: "DevTrack";
  kind: "backup";
  format: 1;
  exported_at: string;
  data: StoreData;
}

export interface BackupSummary {
  tasks: number;
  events: number;
  notes: number;
  exportedAt: string | null;
}

export function summarize(data: StoreData, exportedAt: string | null = null): BackupSummary {
  return { tasks: data.tasks.length, events: data.events.length, notes: data.notes.length, exportedAt };
}

/** Checks a file's text and returns the data it holds, or throws a friendly error. */
export function parseBackup(text: string): { data: StoreData; summary: BackupSummary } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("This file isn't a DevTrack backup.");
  }
  const file = raw as Partial<BackupFile>;
  if (!file || file.app !== "DevTrack" || file.kind !== "backup" || typeof file.data !== "object") {
    throw new Error("This file isn't a DevTrack backup.");
  }
  if (typeof file.format === "number" && file.format > 1) {
    throw new Error("This backup is from a newer version of DevTrack. Update the app first.");
  }
  const data = normalizeStore(file.data);
  return { data, summary: summarize(data, typeof file.exported_at === "string" ? file.exported_at : null) };
}
