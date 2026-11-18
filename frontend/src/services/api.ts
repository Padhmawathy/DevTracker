import { invoke } from "@tauri-apps/api/core";

type DesktopApiResponse = {
  status: number;
  body: string;
};

const IS_PACKAGED_DESKTOP =
  window.location.hostname === "tauri.localhost";

export async function apiFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  if (!IS_PACKAGED_DESKTOP) {
    return window.fetch(input, init);
  }

  const method = (init?.method ?? "GET").toUpperCase();

  let body: unknown = undefined;

  if (init?.body != null) {
    if (typeof init.body !== "string") {
      throw new Error(
        "Desktop API requests must use JSON request bodies."
      );
    }

    body = JSON.parse(init.body);
  }

  const result = await invoke<DesktopApiResponse>(
    "desktop_api_request",
    {
      request: {
        path: input,
        method,
        body,
      },
    }
  );

  return new Response(result.body, {
    status: result.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}


// ==========================================
// DEVTRACKER API SERVICE
// ==========================================

// 1. DAILY SUMMARY TYPES

export interface ProjectSummary {
  work: string[];
  categories: string[];
  blockers: string[];
}

export interface DailySummary {
  date: string;
  total_tracked_seconds: number;
  application_usage: Record<string, number>;
  projects: Record<string, ProjectSummary>;
  activity_count: number;
  checkin_count: number;
}

// 2. ACTIVITY TIMELINE TYPES

export interface Activity {
  id: number;
  process_name: string;
  display_name?: string;
  process_id: number;
  window_title: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
}

export interface DailyActivityResponse {
  date: string;
  activities: Activity[];
  total_activities: number;
}

// 3. CHECK-IN TYPES

export interface DeveloperCheckIn {
  id: number;
  project_name: string;
  work_description: string;
  category: string;
  blocker: string | null;
  created_at: string;
}

export interface CreateCheckInRequest {
  project_name: string;
  work_description: string;
  category: string;
  blocker: string | null;
}

export interface DailyCheckInsResponse {
  date: string;
  checkins: DeveloperCheckIn[];
  total_checkins: number;
}

// ==========================================
// DASHBOARD API
// ==========================================

export async function getTodaySummary(): Promise<DailySummary> {
  const response = await apiFetch("/api/summary/today");

  if (!response.ok) {
    throw new Error(
      `Failed to fetch today's summary: ${response.status}`
    );
  }

  return response.json();
}

// ==========================================
// ACTIVITY TIMELINE API
// ==========================================

export async function getDailyActivity(
  day: string
): Promise<DailyActivityResponse> {
  const response = await apiFetch(
    `/api/activity/${encodeURIComponent(day)}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch daily activity: ${response.status}`
    );
  }

  return response.json();
}

// ==========================================
// CREATE CHECK-IN API
// ==========================================

export async function createCheckIn(
  payload: CreateCheckInRequest
): Promise<DeveloperCheckIn> {
  const response = await apiFetch("/api/checkins", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to save check-in: ${response.status}`
    );
  }

  return response.json();
}

// ==========================================
// GET DAILY CHECK-INS API
// ==========================================

export async function getDailyCheckIns(
  day: string
): Promise<DailyCheckInsResponse> {
  const response = await apiFetch(
    `/api/checkins/${encodeURIComponent(day)}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load check-ins: ${response.status}`
    );
  }

  return response.json();
}



export async function getDailyReport(
  day: string
): Promise<DailySummary> {
  const response = await apiFetch(
    `/api/reports/${encodeURIComponent(day)}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load daily report: ${response.status}`
    );
  }

  return response.json();
}



export interface TrackerSettings {
  // Activity tracking
  tracking_enabled: boolean;
  tracking_consent_granted: boolean;
  poll_interval: number;
  idle_threshold: number;
  min_activity_duration: number;
  collect_window_titles: boolean;

  // Smart check-in reminders
  reminders_enabled: boolean;
  reminder_interval_minutes: number;
  reminder_work_start: string;
  reminder_work_end: string;
  reminder_snooze_minutes: number;
  reminders_respect_idle: boolean;
}


export async function getTrackerSettings(): Promise<TrackerSettings> {
  const response = await apiFetch("/api/settings");

  if (!response.ok) {
    throw new Error("Failed to load tracker settings.");
  }

  return response.json();
}

export async function updateTrackerSettings(
  settings: TrackerSettings
): Promise<TrackerSettings> {
  const response = await apiFetch("/api/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error("Failed to save tracker settings.");
  }

  return response.json();
}



export interface DeveloperProfile {
  display_name: string;
  role: string;
  primary_language: string;
  primary_editor: string;
  daily_focus_goal_minutes: number;
}

export async function getDeveloperProfile(): Promise<DeveloperProfile> {
  const response = await apiFetch("/api/profile");

  if (!response.ok) {
    throw new Error("Failed to load developer profile");
  }

  return response.json();
}

export async function updateDeveloperProfile(
  profile: DeveloperProfile
): Promise<DeveloperProfile> {
  const response = await apiFetch("/api/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    throw new Error("Failed to save developer profile");
  }

  return response.json();
}


export type AppCategory =
  | "development"
  | "research"
  | "testing"
  | "design"
  | "communication"
  | "meetings"
  | "personal"
  | "other";

export interface AppCategoryRule {
  app_name: string;
  category: AppCategory;
}

export interface AppCategoriesResponse {
  rules: AppCategoryRule[];
}

export async function getAppCategories(): Promise<AppCategoriesResponse> {
  const response = await apiFetch("/api/app-categories");

  if (!response.ok) {
    throw new Error("Failed to load application categories");
  }

  return (await response.json()) as AppCategoriesResponse;
}

export async function updateAppCategories(
  rules: AppCategoryRule[]
): Promise<AppCategoriesResponse> {
  const response = await apiFetch("/api/app-categories", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rules }),
  });

  if (!response.ok) {
    throw new Error("Failed to save application categories");
  }

  return (await response.json()) as AppCategoriesResponse;
}

export async function submitReminderAction(
  action: "snooze" | "skip",
  reminderId: string
): Promise<void> {
  const response = await apiFetch("/api/reminders/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      reminder_id: reminderId,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Reminder action failed: ${response.status}`
    );
  }
}
// ==========================================
// JOBS & CALENDAR WORK LOG
// ==========================================

export type JobStatus = "active" | "archived";
export type WorkEntryStatus = "planned" | "done";
export type Platform = "linkedin" | "instagram" | "reddit" | "x" | "other";

export const PLATFORM_LABELS: Record<Platform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  reddit: "Reddit",
  x: "X",
  other: "Other",
};

export interface Job {
  id: number;
  name: string;
  client: string | null;
  color: string;
  emoji: string | null;
  status: JobStatus;
  created_at: string;
  done_hours: number;
  planned_hours: number;
  entry_count: number;
  post_count: number;
  last_entry_date: string | null;
}

export interface JobPayload {
  name: string;
  client: string | null;
  color: string;
  emoji: string | null;
  status: JobStatus;
}

export interface WorkEntry {
  id: number;
  job_id: number;
  job_name: string;
  job_color: string;
  job_emoji: string | null;
  entry_date: string;
  hours: number | null;
  description: string;
  status: WorkEntryStatus;
  platform: Platform | null;
  link: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkEntryPayload {
  job_id: number;
  entry_date: string;
  hours: number | null;
  description: string;
  status: WorkEntryStatus;
  platform: Platform | null;
  link: string | null;
}

async function readError(response: Response, fallback: string): Promise<Error> {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") return new Error(data.detail);
  } catch {
    // ignore non-JSON bodies
  }
  return new Error(`${fallback} (${response.status})`);
}

async function sendJson<T>(
  path: string,
  method: "POST" | "PUT",
  body: unknown,
  fallback: string
): Promise<T> {
  const response = await apiFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) throw await readError(response, fallback);
  return response.json();
}

export async function getJobs(): Promise<Job[]> {
  const response = await apiFetch("/api/jobs");
  if (!response.ok) throw await readError(response, "Failed to load jobs");
  return (await response.json()).jobs;
}

export function createJob(payload: JobPayload): Promise<Job> {
  return sendJson("/api/jobs", "POST", payload, "Failed to create job");
}

export function updateJob(id: number, payload: JobPayload): Promise<Job> {
  return sendJson(`/api/jobs/${id}`, "PUT", payload, "Failed to update job");
}

export async function getWorkEntries(
  start: string,
  end: string
): Promise<WorkEntry[]> {
  const params = new URLSearchParams({ start, end });
  const response = await apiFetch(`/api/work-entries?${params}`);
  if (!response.ok) throw await readError(response, "Failed to load entries");
  return (await response.json()).entries;
}

export function createWorkEntry(payload: WorkEntryPayload): Promise<WorkEntry> {
  return sendJson("/api/work-entries", "POST", payload, "Failed to save entry");
}

export function updateWorkEntry(
  id: number,
  payload: WorkEntryPayload
): Promise<WorkEntry> {
  return sendJson(`/api/work-entries/${id}`, "PUT", payload, "Failed to save entry");
}

export async function deleteWorkEntry(id: number): Promise<void> {
  await sendJson(`/api/work-entries/${id}/delete`, "POST", {}, "Failed to delete entry");
}

// ==========================================
// TASKS
// ==========================================

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "none" | "low" | "medium" | "high";

export interface Task {
  id: number;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  job_id: number | null;
  job_name: string | null;
  job_color: string | null;
  job_emoji: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TaskPayload {
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  job_id: number | null;
}

export async function getTasks(): Promise<Task[]> {
  const response = await apiFetch("/api/tasks");
  if (!response.ok) throw await readError(response, "Failed to load tasks");
  return (await response.json()).tasks;
}

export function createTask(payload: TaskPayload): Promise<Task> {
  return sendJson("/api/tasks", "POST", payload, "Failed to create task");
}

export function updateTask(id: number, payload: TaskPayload): Promise<Task> {
  return sendJson(`/api/tasks/${id}`, "PUT", payload, "Failed to save task");
}

export async function deleteTask(id: number): Promise<void> {
  await sendJson(`/api/tasks/${id}/delete`, "POST", {}, "Failed to delete task");
}
