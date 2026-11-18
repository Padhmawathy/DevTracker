/**
 * Schedules task and event reminders as Android notifications.
 * Every sync cancels the reminders DevTrack scheduled before and schedules the
 * current plan, so edits, deletes and completed tasks are always reflected.
 */
import { IS_ANDROID } from "../lib/platform";
import type { StoreData } from "./localStore";
import { isOurReminderId, planReminders } from "./reminderPlan";

const CHANNEL_ID = "reminders";
let channelReady = false;
let running: Promise<void> = Promise.resolve();

/** Asks for notification permission (shown once by Android). Returns whether granted. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!IS_ANDROID) return true;
  const { isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
  if (await isPermissionGranted()) return true;
  return (await requestPermission()) === "granted";
}

async function sync(data: StoreData): Promise<void> {
  const n = await import("@tauri-apps/plugin-notification");
  if (!(await n.isPermissionGranted())) return;

  if (!channelReady) {
    await n.createChannel({
      id: CHANNEL_ID,
      name: "Reminders",
      description: "Task and event reminders",
      importance: n.Importance.High,
      visibility: n.Visibility.Private,
      vibration: true,
    });
    channelReady = true;
  }

  const ours = (await n.pending()).map((p) => p.id).filter(isOurReminderId);
  if (ours.length) await n.cancel(ours);

  for (const r of planReminders(data, new Date())) {
    n.sendNotification({
      id: r.id,
      channelId: CHANNEL_ID,
      title: r.title,
      body: r.body,
      schedule: n.Schedule.at(r.at, false, true),
    });
  }
}

/** Refreshes scheduled reminders from the given data (Android only, never throws). */
export function syncReminders(data: StoreData): void {
  if (!IS_ANDROID) return;
  const snapshot = structuredClone(data);
  running = running
    .then(() => sync(snapshot))
    .catch((err) => console.warn("[DevTrack] reminder sync failed", err));
}
