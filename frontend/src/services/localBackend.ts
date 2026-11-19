/**
 * Runs DevTrack's API on the device itself (Android) and keeps the data in a
 * private file in the app's storage. In the browser mobile preview it uses
 * localStorage instead, so the phone UI can be tried without a phone.
 */
import { invoke } from "@tauri-apps/api/core";
import { IS_ANDROID } from "../lib/platform";
import {
  emptyStore,
  handleLocalRequest,
  normalizeStore,
  type LocalRequest,
  type LocalResponse,
  type StoreData,
} from "./localStore";
import { syncReminders } from "./reminders";

const PREVIEW_KEY = "devtrack.mobile-preview.data";

async function readSaved(): Promise<StoreData> {
  if (IS_ANDROID) {
    const text = await invoke<string | null>("load_store");
    return text ? normalizeStore(JSON.parse(text)) : emptyStore();
  }
  try {
    const text = localStorage.getItem(PREVIEW_KEY);
    return text ? normalizeStore(JSON.parse(text)) : emptyStore();
  } catch {
    return emptyStore();
  }
}

async function writeSaved(data: StoreData): Promise<void> {
  const text = JSON.stringify(data);
  if (IS_ANDROID) {
    await invoke("save_store", { data: text });
    return;
  }
  try {
    localStorage.setItem(PREVIEW_KEY, text);
  } catch {
    // Preview only: storage may be blocked; keep working in memory.
  }
}

let loaded: Promise<StoreData> | null = null;
// Requests run one at a time so a save never races the next change.
let queue: Promise<unknown> = Promise.resolve();

function store(): Promise<StoreData> {
  if (!loaded) {
    loaded = readSaved();
    // Re-plan reminders each time the app starts (alarms can be lost on reboot).
    loaded.then(syncReminders, () => undefined);
  }
  return loaded;
}

export function localRequest(req: LocalRequest): Promise<LocalResponse> {
  const run = queue.then(async () => {
    const data = await store();
    // Work on a copy so a failed save leaves memory matching the file.
    const draft: StoreData = structuredClone(data);
    const result = handleLocalRequest(draft, req);
    if (result.changed) {
      await writeSaved(draft);
      Object.assign(data, draft);
      syncReminders(data);
    }
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** The whole document, for Export backup. */
export async function exportData(): Promise<StoreData> {
  await queue;
  return structuredClone(await store());
}

/** Replaces everything with a backup's contents. */
export function importData(raw: unknown): Promise<void> {
  const run = queue.then(async () => {
    const next = normalizeStore(raw);
    await writeSaved(next);
    Object.assign(await store(), next);
    syncReminders(next);
  });
  queue = run.catch(() => undefined);
  return run;
}
