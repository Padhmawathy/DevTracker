
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
  const response = await fetch("/api/summary/today");

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
  const response = await fetch(
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
  const response = await fetch("/api/checkins", {
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
  const response = await fetch(
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
  const response = await fetch(
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
  tracking_enabled: boolean;
  poll_interval: number;
  idle_threshold: number;
  min_activity_duration: number;
  collect_window_titles: boolean;
}

export async function getTrackerSettings(): Promise<TrackerSettings> {
  const response = await fetch("/api/settings");

  if (!response.ok) {
    throw new Error("Failed to load tracker settings.");
  }

  return response.json();
}

export async function updateTrackerSettings(
  settings: TrackerSettings
): Promise<TrackerSettings> {
  const response = await fetch("/api/settings", {
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
