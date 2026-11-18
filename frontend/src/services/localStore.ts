/**
 * DevTrack's on-phone data engine.
 *
 * The phone has no Python backend, so this answers the same /api/... requests
 * the desktop backend does (tasks, jobs, work entries, check-ins), using the
 * same rules and response shapes, over one in-memory document that the caller
 * persists. It is pure: no I/O, no globals, so it can be unit-tested in Node.
 */
import type {
  DeveloperCheckIn,
  DeveloperProfile,
  CalendarEvent,
  Job,
  Note,
  JobStatus,
  Platform,
  Repeat,
  Task,
  TaskPriority,
  TaskStatus,
  WorkEntry,
  WorkEntryStatus,
} from "./api";

export const STORE_VERSION = 1;

export interface StoredJob {
  id: number;
  name: string;
  client: string | null;
  color: string;
  emoji: string | null;
  status: JobStatus;
  created_at: string;
}

export interface StoredEntry {
  id: number;
  job_id: number;
  entry_date: string;
  hours: number | null;
  description: string;
  status: WorkEntryStatus;
  platform: Platform | null;
  link: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredTask {
  id: number;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  job_id: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  remind_at?: string | null;
  repeat?: Repeat;
}

export type StoredCheckIn = DeveloperCheckIn;
export type StoredNote = Note;
export type StoredEvent = CalendarEvent;

export interface StoreData {
  version: number;
  next_id: { jobs: number; entries: number; tasks: number; checkins: number; notes: number; events: number };
  jobs: StoredJob[];
  entries: StoredEntry[];
  tasks: StoredTask[];
  checkins: StoredCheckIn[];
  notes: StoredNote[];
  events: StoredEvent[];
  profile: DeveloperProfile;
}

export interface LocalRequest {
  path: string;
  method: string;
  body?: unknown;
}

export interface LocalResponse {
  status: number;
  body: unknown;
  /** True when the request changed the data and it must be saved. */
  changed: boolean;
}

export function emptyStore(): StoreData {
  return {
    version: STORE_VERSION,
    next_id: { jobs: 1, entries: 1, tasks: 1, checkins: 1, notes: 1, events: 1 },
    jobs: [],
    entries: [],
    tasks: [],
    checkins: [],
    notes: [],
    events: [],
    profile: defaultProfile(),
  };
}

function defaultProfile(): DeveloperProfile {
  return { display_name: "", role: "", primary_language: "", primary_editor: "", daily_focus_goal_minutes: 240 };
}

/** Accepts a parsed saved document (or a backup) and fills in anything missing. */
export function normalizeStore(raw: unknown): StoreData {
  const base = emptyStore();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<StoreData>;
  const data: StoreData = {
    version: STORE_VERSION,
    next_id: { ...base.next_id, ...(r.next_id ?? {}) },
    jobs: Array.isArray(r.jobs) ? r.jobs : [],
    entries: Array.isArray(r.entries) ? r.entries : [],
    tasks: Array.isArray(r.tasks) ? r.tasks : [],
    checkins: Array.isArray(r.checkins) ? r.checkins : [],
    notes: Array.isArray(r.notes) ? r.notes : [],
    events: Array.isArray(r.events) ? r.events : [],
    profile: { ...defaultProfile(), ...(r.profile && typeof r.profile === "object" ? r.profile : {}) },
  };
  // Never hand out an id that is already used.
  const bump = (key: keyof StoreData["next_id"], rows: { id: number }[]) => {
    const max = rows.reduce((m, row) => Math.max(m, row.id), 0);
    data.next_id[key] = Math.max(data.next_id[key], max + 1);
  };
  bump("jobs", data.jobs);
  bump("entries", data.entries);
  bump("tasks", data.tasks);
  bump("checkins", data.checkins);
  bump("notes", data.notes);
  bump("events", data.events);
  return data;
}

// ---------------------------------------------------------------- helpers

class HttpError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMOJI_FORBIDDEN = /[\sA-Za-z0-9<>&"']/;
const JOB_STATUSES: JobStatus[] = ["active", "archived"];
const ENTRY_STATUSES: WorkEntryStatus[] = ["planned", "done"];
const PLATFORMS: Platform[] = ["linkedin", "instagram", "reddit", "x", "other"];
const TASK_PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high"];
const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2, none: 3 };

/** Local time as an ISO string without a zone, like Python's datetime.now().isoformat(). */
export function localIso(d: Date = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}000`
  );
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function obj(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(422, "Request body must be an object.");
  }
  return body as Record<string, unknown>;
}

function str(value: unknown, field: string, { required = false, max = Infinity } = {}): string | null {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(422, `${field} is required.`);
    return null;
  }
  if (typeof value !== "string") throw new HttpError(422, `${field} must be text.`);
  if (value.length > max) throw new HttpError(422, `${field} is too long.`);
  if (required && !value.trim()) throw new HttpError(422, `${field} is required.`);
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T, message: string): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new HttpError(422, message);
  return value as T;
}

function intOrNull(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) throw new HttpError(422, `${field} must be a number.`);
  return value;
}

function trimOrNull(value: string | null): string | null {
  const t = (value ?? "").trim();
  return t || null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------- jobs

function jobView(data: StoreData, job: StoredJob): Job {
  let done = 0;
  let planned = 0;
  let count = 0;
  let posts = 0;
  let last: string | null = null;
  for (const e of data.entries) {
    if (e.job_id !== job.id) continue;
    count += 1;
    if (e.platform) posts += 1;
    if (e.hours != null) {
      if (e.status === "done") done += e.hours;
      else planned += e.hours;
    }
    if (last === null || e.entry_date > last) last = e.entry_date;
  }
  return {
    ...job,
    done_hours: round2(done),
    planned_hours: round2(planned),
    entry_count: count,
    post_count: posts,
    last_entry_date: last,
  };
}

function listJobs(data: StoreData): Job[] {
  return [...data.jobs]
    .sort((a, b) =>
      a.status !== b.status
        ? a.status < b.status ? -1 : 1
        : a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    )
    .map((job) => jobView(data, job));
}

function parseJob(data: StoreData, body: unknown, selfId: number | null) {
  const b = obj(body);
  const name = str(b.name, "Job name", { required: true, max: 100 })!.trim();
  const client = trimOrNull(str(b.client, "Client", { max: 100 }));
  const color = str(b.color, "Color") ?? "#4f9d7a";
  if (!COLOR_PATTERN.test(color)) throw new HttpError(422, "Color must be a hex value like #4f9d7a.");
  const emoji = trimOrNull(str(b.emoji, "Emoji", { max: 16 }));
  if (emoji !== null && EMOJI_FORBIDDEN.test(emoji)) throw new HttpError(422, "Emoji must be a single emoji.");
  const status = oneOf(b.status, JOB_STATUSES, "active", "Job status must be active or archived.");
  const lower = name.toLowerCase();
  if (data.jobs.some((j) => j.id !== selfId && j.name.toLowerCase() === lower)) {
    throw new HttpError(409, "A job with this name already exists.");
  }
  return { name, client, color: color.toLowerCase(), emoji, status };
}

function findJob(data: StoreData, id: number): StoredJob {
  const job = data.jobs.find((j) => j.id === id);
  if (!job) throw new HttpError(404, "Job not found.");
  return job;
}

// ---------------------------------------------------------------- entries

function entryView(data: StoreData, e: StoredEntry): WorkEntry {
  const job = data.jobs.find((j) => j.id === e.job_id);
  return {
    ...e,
    job_name: job?.name ?? "",
    job_color: job?.color ?? "#8e8e93",
    job_emoji: job?.emoji ?? null,
  };
}

function parseEntry(data: StoreData, body: unknown) {
  const b = obj(body);
  const job_id = intOrNull(b.job_id, "Job");
  if (job_id === null) throw new HttpError(422, "Job is required.");
  const entry_date = str(b.entry_date, "Entry date", { required: true })!;
  if (!isValidDate(entry_date)) throw new HttpError(422, "Entry date is required.");
  let hours: number | null = null;
  if (b.hours !== undefined && b.hours !== null) {
    if (typeof b.hours !== "number" || !(b.hours > 0 && b.hours <= 24)) {
      throw new HttpError(422, "Hours must be greater than 0 and at most 24.");
    }
    hours = round2(b.hours);
  }
  const description = str(b.description, "Description", { required: true, max: 2000 })!.trim();
  const status = oneOf(b.status, ENTRY_STATUSES, "done", "Entry status must be planned or done.");
  const platform = b.platform == null ? null : oneOf(b.platform, PLATFORMS, "other", "Unknown platform.");
  const link = trimOrNull(str(b.link, "Link", { max: 2000 }));
  if (link && !/^https?:\/\//i.test(link)) throw new HttpError(422, "Link must start with http:// or https://.");
  findJob(data, job_id);
  return { job_id, entry_date, hours, description, status, platform, link };
}

function findEntry(data: StoreData, id: number): StoredEntry {
  const e = data.entries.find((x) => x.id === id);
  if (!e) throw new HttpError(404, "Work entry not found.");
  return e;
}

// ---------------------------------------------------------------- tasks

function taskView(data: StoreData, t: StoredTask): Task {
  const job = t.job_id == null ? undefined : data.jobs.find((j) => j.id === t.job_id);
  return {
    ...t,
    job_name: job?.name ?? null,
    job_color: job?.color ?? null,
    job_emoji: job?.emoji ?? null,
  };
}

/** Same order as the desktop: open first (by due date, then priority), done newest first. */
export function compareTasks(a: StoredTask, b: StoredTask): number {
  const ad = a.status === "done" ? 1 : 0;
  const bd = b.status === "done" ? 1 : 0;
  if (ad !== bd) return ad - bd;
  if (ad === 1) {
    const ac = a.completed_at ?? "";
    const bc = b.completed_at ?? "";
    if (ac !== bc) return ac < bc ? 1 : -1;
  }
  const an = a.due_date == null ? 1 : 0;
  const bn = b.due_date == null ? 1 : 0;
  if (an !== bn) return an - bn;
  if (a.due_date !== b.due_date) return (a.due_date ?? "") < (b.due_date ?? "") ? -1 : 1;
  const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (pr !== 0) return pr;
  return a.id - b.id;
}

function parseTask(data: StoreData, body: unknown) {
  const b = obj(body);
  const title = str(b.title, "Task title", { required: true, max: 200 })!.trim();
  const notes = trimOrNull(str(b.notes, "Task notes", { max: 4000 }));
  const due = str(b.due_date, "Due date");
  if (due !== null && !isValidDate(due)) throw new HttpError(422, "Due date must be a date.");
  const priority = oneOf(b.priority, TASK_PRIORITIES, "none", "Priority must be none, low, medium or high.");
  const status = oneOf(b.status, TASK_STATUSES, "todo", "Status must be todo, in_progress or done.");
  const job_id = intOrNull(b.job_id, "Job");
  if (job_id !== null) findJob(data, job_id);
  // Left out (e.g. ticking a task off) keeps the current reminder.
  let remind_at: string | null | undefined;
  if (b.remind_at !== undefined) {
    remind_at = str(b.remind_at, "Reminder");
    if (remind_at !== null && !REMIND_PATTERN.test(remind_at)) throw new HttpError(422, "Reminder must be a date and time.");
    if (remind_at !== null && !isValidDate(remind_at.slice(0, 10))) throw new HttpError(422, "Reminder must be a date and time.");
  }
  const repeat = b.repeat === undefined ? undefined : oneOf(b.repeat, REPEATS, "none", "Unknown repeat.");
  return { title, notes, due_date: due, priority, status, job_id, remind_at, repeat };
}

const REMIND_PATTERN = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

function findTask(data: StoreData, id: number): StoredTask {
  const t = data.tasks.find((x) => x.id === id);
  if (!t) throw new HttpError(404, "Task not found.");
  return t;
}

// ---------------------------------------------------------------- check-ins

function dailyCheckIns(data: StoreData, day: string) {
  const checkins = data.checkins
    .filter((c) => c.created_at.slice(0, 10) === day)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id));
  return { date: day, checkins, total_checkins: checkins.length };
}

// ---------------------------------------------------------------- notes

const NOTE_COLORS = ["none", "yellow", "green", "blue", "pink", "purple"] as const;

function parseNote(body: unknown) {
  const b = obj(body);
  const title = (str(b.title, "Title", { max: 200 }) ?? "").trim();
  const text = str(b.body, "Note", { max: 20000 }) ?? "";
  if (!title && !text.trim()) throw new HttpError(422, "A note needs a title or some text.");
  if (b.pinned !== undefined && typeof b.pinned !== "boolean") throw new HttpError(422, "Pinned must be true or false.");
  const color = oneOf(b.color, [...NOTE_COLORS], "none", "Unknown note colour.");
  return { title, body: text.replace(/\s+$/, ""), pinned: b.pinned === true, color };
}

function findNote(data: StoreData, id: number): StoredNote {
  const n = data.notes.find((x) => x.id === id);
  if (!n) throw new HttpError(404, "Note not found.");
  return n;
}

/** Pinned first, then most recently edited. */
export function compareNotes(a: StoredNote, b: StoredNote): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (a.updated_at !== b.updated_at) return a.updated_at < b.updated_at ? 1 : -1;
  return b.id - a.id;
}

// ---------------------------------------------------------------- events

const EVENT_COLORS = ["blue", "green", "orange", "red", "purple", "pink", "teal", "graphite"] as const;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Allowed event reminder offsets, in minutes before the start. */
export const ALERT_MINUTES = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];

function parseEvent(body: unknown) {
  const b = obj(body);
  const title = str(b.title, "Title", { required: true, max: 200 })!.trim();
  const date = str(b.date, "Date", { required: true })!;
  if (!isValidDate(date)) throw new HttpError(422, "Date must be a date.");
  const start_time = str(b.start_time, "Start time");
  const end_time = str(b.end_time, "End time");
  if (start_time !== null && !TIME_PATTERN.test(start_time)) throw new HttpError(422, "Start time must look like 09:30.");
  if (end_time !== null && !TIME_PATTERN.test(end_time)) throw new HttpError(422, "End time must look like 10:30.");
  if (end_time !== null && start_time === null) throw new HttpError(422, "Add a start time before an end time.");
  if (end_time !== null && start_time !== null && end_time <= start_time) {
    throw new HttpError(422, "End time must be after the start time.");
  }
  const color = oneOf(b.color, [...EVENT_COLORS], "blue", "Unknown event colour.");
  const notes = trimOrNull(str(b.notes, "Notes", { max: 4000 }));
  let alert: number | null = null;
  if (b.alert !== undefined && b.alert !== null) {
    if (typeof b.alert !== "number" || !ALERT_MINUTES.includes(b.alert)) throw new HttpError(422, "Unknown reminder time.");
    alert = b.alert;
  }
  const repeat = oneOf(b.repeat, REPEATS, "none", "Unknown repeat.");
  let repeat_until = str(b.repeat_until, "Repeat until");
  if (repeat === "none") repeat_until = null;
  if (repeat_until !== null && (!isValidDate(repeat_until) || repeat_until < date)) {
    throw new HttpError(422, "The repeat end date must be on or after the event date.");
  }
  return { title, date, start_time, end_time, color, notes, alert, repeat, repeat_until };
}

function findEvent(data: StoreData, id: number): StoredEvent {
  const e = data.events.find((x) => x.id === id);
  if (!e) throw new HttpError(404, "Event not found.");
  return e;
}

/** The dates (YYYY-MM-DD) on which an event happens within [start, end]. */
export function eventOccurrences(e: StoredEvent, start: string, end: string): string[] {
  const repeat = e.repeat ?? "none";
  if (repeat === "none") return e.date >= start && e.date <= end ? [e.date] : [];
  const last = e.repeat_until && e.repeat_until < end ? e.repeat_until : end;
  const out: string[] = [];
  // Walk the series; repeats are cheap to step and ranges are a few weeks.
  for (let i = 0, d = e.date; d <= last && i < 20000; i++) {
    if (d >= start) out.push(d);
    d = nextRepeatDate(e.date, repeat, d);
  }
  return out;
}

// ---------------------------------------------------------------- repeats

const REPEATS: Repeat[] = ["none", "daily", "weekdays", "weekly", "monthly", "yearly"];

function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = ymd(iso);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = ymd(a);
  const [by, bm, bd] = ymd(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/**
 * The next date after `current` in a series that started on `anchor`.
 * Monthly/yearly keep the anchor's day and skip months that don't have it
 * (an event on the 31st happens only in 31-day months; 29 Feb only in leap years).
 */
export function nextRepeatDate(anchor: string, repeat: Repeat, current: string = anchor): string {
  const [, am, ad] = ymd(anchor);
  const [cy, cm] = ymd(current);
  switch (repeat) {
    case "daily":
      return addDays(current, 1);
    case "weekdays": {
      let next = addDays(current, 1);
      const dow = () => new Date(`${next}T00:00:00Z`).getUTCDay();
      while (dow() === 0 || dow() === 6) next = addDays(next, 1);
      return next;
    }
    case "weekly":
      return addDays(current, 7);
    case "monthly": {
      let y = cy;
      let m = cm;
      for (let i = 0; i < 48; i++) {
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
        if (ad <= daysInMonth(y, m)) return fmt(y, m, ad);
      }
      return "9999-12-31";
    }
    case "yearly": {
      for (let y = cy + 1; y < cy + 9; y++) {
        if (ad <= daysInMonth(y, am)) return fmt(y, am, ad);
      }
      return "9999-12-31";
    }
    default:
      return "9999-12-31";
  }
}

/** By day, all-day events first, then by start time. */
export function compareEvents(a: StoredEvent, b: StoredEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const at = a.start_time ?? "";
  const bt = b.start_time ?? "";
  if (at !== bt) return at < bt ? -1 : 1;
  return a.id - b.id;
}

// ---------------------------------------------------------------- router

const ok = (body: unknown, status = 200): LocalResponse => ({ status, body, changed: false });
const saved = (body: unknown, status = 200): LocalResponse => ({ status, body, changed: true });

/**
 * Handles one API request against `data`, mutating it in place for writes.
 * Unknown routes answer 404 so pages fail the same way they would on desktop.
 */
export function handleLocalRequest(data: StoreData, req: LocalRequest, now: Date = new Date()): LocalResponse {
  const method = req.method.toUpperCase();
  const [pathOnly, query = ""] = req.path.split("?", 2);
  const parts = pathOnly.replace(/^\/api\//, "").split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  const id = parts[1] !== undefined && /^\d+$/.test(parts[1]) ? Number(parts[1]) : null;
  const stamp = localIso(now);

  try {
    switch (parts[0]) {
      case "tasks": {
        if (parts.length === 1 && method === "GET") {
          return ok({ tasks: [...data.tasks].sort(compareTasks).map((t) => taskView(data, t)) });
        }
        if (parts.length === 1 && method === "POST") {
          const v = parseTask(data, req.body);
          const task: StoredTask = {
            id: data.next_id.tasks++,
            ...v,
            remind_at: v.remind_at ?? null,
            repeat: v.repeat ?? "none",
            created_at: stamp,
            updated_at: stamp,
            completed_at: v.status === "done" ? stamp : null,
          };
          data.tasks.push(task);
          return saved(taskView(data, task), 201);
        }
        if (id !== null && parts.length === 2 && method === "PUT") {
          const task = findTask(data, id);
          const v = parseTask(data, req.body);
          const completed_at =
            v.status !== "done" ? null : task.status === "done" ? task.completed_at ?? stamp : stamp;
          const remind_at = v.remind_at === undefined ? task.remind_at ?? null : v.remind_at;
          const repeat = v.repeat === undefined ? task.repeat ?? "none" : v.repeat;
          const justCompleted = v.status === "done" && task.status !== "done";
          Object.assign(task, v, { updated_at: stamp, completed_at, remind_at, repeat });
          // Finishing a repeating task schedules the next one.
          if (justCompleted && repeat !== "none") {
            const from = task.due_date ?? stamp.slice(0, 10);
            const nextDue = nextRepeatDate(from, repeat);
            const shift = daysBetween(from, nextDue);
            data.tasks.push({
              ...task,
              id: data.next_id.tasks++,
              status: "todo",
              due_date: nextDue,
              remind_at: task.remind_at ? `${addDays(task.remind_at.slice(0, 10), shift)}${task.remind_at.slice(10)}` : null,
              created_at: stamp,
              updated_at: stamp,
              completed_at: null,
            });
            // The finished one no longer repeats, so un-ticking it can't duplicate.
            task.repeat = "none";
          }
          return saved(taskView(data, task));
        }
        if (id !== null && parts[2] === "delete" && method === "POST") {
          findTask(data, id);
          data.tasks = data.tasks.filter((t) => t.id !== id);
          return saved({ deleted: true });
        }
        break;
      }

      case "jobs": {
        if (parts.length === 1 && method === "GET") {
          const includeArchived = params.get("include_archived") !== "false";
          const jobs = listJobs(data);
          return ok({ jobs: includeArchived ? jobs : jobs.filter((j) => j.status === "active") });
        }
        if (parts.length === 1 && method === "POST") {
          const v = parseJob(data, req.body, null);
          const job: StoredJob = { id: data.next_id.jobs++, ...v, created_at: stamp };
          data.jobs.push(job);
          return saved(jobView(data, job), 201);
        }
        if (id !== null && parts.length === 2 && method === "PUT") {
          const job = findJob(data, id);
          Object.assign(job, parseJob(data, req.body, id));
          return saved(jobView(data, job));
        }
        break;
      }

      case "work-entries": {
        if (parts.length === 1 && method === "GET") {
          const start = params.get("start") ?? "";
          const end = params.get("end") ?? "";
          if (!isValidDate(start) || !isValidDate(end)) throw new HttpError(422, "Invalid date range.");
          const jobFilter = params.get("job_id");
          const entries = data.entries
            .filter((e) => e.entry_date >= start && e.entry_date <= end)
            .filter((e) => jobFilter == null || e.job_id === Number(jobFilter))
            .filter((e) => data.jobs.some((j) => j.id === e.job_id))
            .sort((a, b) => (a.entry_date !== b.entry_date ? (a.entry_date < b.entry_date ? -1 : 1) : a.id - b.id))
            .map((e) => entryView(data, e));
          return ok({ entries });
        }
        if (parts.length === 1 && method === "POST") {
          const v = parseEntry(data, req.body);
          const entry: StoredEntry = { id: data.next_id.entries++, ...v, created_at: stamp, updated_at: stamp };
          data.entries.push(entry);
          return saved(entryView(data, entry), 201);
        }
        if (id !== null && parts.length === 2 && method === "PUT") {
          const entry = findEntry(data, id);
          Object.assign(entry, parseEntry(data, req.body), { updated_at: stamp });
          return saved(entryView(data, entry));
        }
        if (id !== null && parts[2] === "delete" && method === "POST") {
          findEntry(data, id);
          data.entries = data.entries.filter((e) => e.id !== id);
          return saved({ deleted: true });
        }
        break;
      }

      case "profile": {
        if (parts.length === 1 && method === "GET") return ok(data.profile);
        if (parts.length === 1 && method === "PUT") {
          const b = obj(req.body);
          const display_name = (str(b.display_name, "Name", { max: 60 }) ?? "").trim();
          data.profile = { ...data.profile, display_name };
          return saved(data.profile);
        }
        break;
      }

      case "events": {
        if (parts.length === 1 && method === "GET") {
          const start = params.get("start") ?? "";
          const end = params.get("end") ?? "";
          if (!isValidDate(start) || !isValidDate(end)) throw new HttpError(422, "Invalid date range.");
          const events = data.events.flatMap((e) =>
            eventOccurrences(e, start, end).map((date) => ({ ...e, date, series_start: e.date })),
          );
          return ok({ events: events.sort(compareEvents) });
        }
        if (parts.length === 1 && method === "POST") {
          const v = parseEvent(req.body);
          const event: StoredEvent = { id: data.next_id.events++, ...v, created_at: stamp, updated_at: stamp };
          data.events.push(event);
          return saved(event, 201);
        }
        if (id !== null && parts.length === 2 && method === "PUT") {
          const event = findEvent(data, id);
          Object.assign(event, parseEvent(req.body), { updated_at: stamp });
          return saved(event);
        }
        if (id !== null && parts[2] === "delete" && method === "POST") {
          findEvent(data, id);
          data.events = data.events.filter((e) => e.id !== id);
          return saved({ deleted: true });
        }
        break;
      }

      case "notes": {
        if (parts.length === 1 && method === "GET") {
          return ok({ notes: [...data.notes].sort(compareNotes) });
        }
        if (parts.length === 1 && method === "POST") {
          const v = parseNote(req.body);
          const note: StoredNote = { id: data.next_id.notes++, ...v, created_at: stamp, updated_at: stamp };
          data.notes.push(note);
          return saved(note, 201);
        }
        if (id !== null && parts.length === 2 && method === "PUT") {
          const note = findNote(data, id);
          Object.assign(note, parseNote(req.body), { updated_at: stamp });
          return saved(note);
        }
        if (id !== null && parts[2] === "delete" && method === "POST") {
          findNote(data, id);
          data.notes = data.notes.filter((n) => n.id !== id);
          return saved({ deleted: true });
        }
        break;
      }

      case "checkins": {
        if (parts.length === 1 && method === "POST") {
          const b = obj(req.body);
          const project_name = (str(b.project_name, "Project name") ?? "").trim();
          const work_description = (str(b.work_description, "Work description") ?? "").trim();
          if (!project_name || !work_description) {
            throw new HttpError(422, "Project name and work description are required.");
          }
          const checkin: StoredCheckIn = {
            id: data.next_id.checkins++,
            project_name,
            work_description,
            category: (str(b.category, "Category") ?? "").trim() || "Other",
            blocker: trimOrNull(str(b.blocker, "Blocker")),
            created_at: stamp,
          };
          data.checkins.push(checkin);
          return saved(checkin, 201);
        }
        if (parts.length === 2 && method === "GET") {
          if (!isValidDate(parts[1])) throw new HttpError(400, "Invalid date. Use YYYY-MM-DD.");
          return ok(dailyCheckIns(data, parts[1]));
        }
        break;
      }
    }
    return ok({ detail: "Not available on the phone." }, 404);
  } catch (err) {
    if (err instanceof HttpError) return ok({ detail: err.message }, err.status);
    throw err;
  }
}
