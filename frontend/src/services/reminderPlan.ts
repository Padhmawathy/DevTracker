/**
 * Works out which reminder notifications should be scheduled on the phone.
 * Pure (no I/O) so it can be unit-tested; reminders.ts does the scheduling.
 */
import { eventOccurrences, type StoreData } from "./localStore.ts";

export interface PlannedReminder {
  /** Stable notification id (32-bit int). */
  id: number;
  at: Date;
  title: string;
  body: string;
}

/** Ids we own: tasks 1,000,000+, events 2,000,000+ (never collide with others). */
export const TASK_ID_BASE = 1_000_000;
export const EVENT_ID_BASE = 2_000_000;
export const isOurReminderId = (id: number) => id >= TASK_ID_BASE && id < 1_000_000_000;

/** All-day events remind relative to 9:00 that morning. */
const ALL_DAY_TIME = "09:00";

function localDate(isoDate: string, hhmm: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function clock(d: Date): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

function dayWord(start: Date, now: Date): string {
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((a - b) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "short" }).format(start);
}

/**
 * Upcoming reminders, soonest first. Android limits how many alarms an app may
 * hold, so only the next `horizonDays` and at most `max` are planned; the plan
 * is refreshed every time the app opens or data changes.
 */
export function planReminders(data: StoreData, now: Date, horizonDays = 30, max = 60): PlannedReminder[] {
  const horizon = new Date(now.getTime() + horizonDays * 86_400_000);
  const out: PlannedReminder[] = [];

  for (const t of data.tasks) {
    if (t.status === "done" || !t.remind_at) continue;
    const at = localDate(t.remind_at.slice(0, 10), t.remind_at.slice(11, 16));
    if (at <= now || at > horizon) continue;
    out.push({
      id: TASK_ID_BASE + t.id,
      at,
      title: t.title,
      body: t.due_date && t.due_date < iso(at) ? "Overdue task" : "Task reminder",
    });
  }

  // Look back a week too: an event can start after its reminder time has passed.
  const from = iso(new Date(now.getTime() - 7 * 86_400_000));
  const to = iso(new Date(horizon.getTime() + 7 * 86_400_000));
  for (const e of data.events) {
    if (e.alert === null || e.alert === undefined) continue;
    eventOccurrences(e, from, to).forEach((date, index) => {
      if (index >= 1000) return;
      const start = localDate(date, e.start_time ?? ALL_DAY_TIME);
      const at = new Date(start.getTime() - e.alert! * 60_000);
      if (at <= now || at > horizon) return;
      const when = e.start_time ? `${dayWord(start, at)} at ${clock(start)}` : `${dayWord(start, at)} · All day`;
      out.push({ id: EVENT_ID_BASE + e.id * 1000 + index, at, title: e.title, body: when });
    });
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, max);
}
