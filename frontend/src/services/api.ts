
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

export async function getTodaySummary(): Promise<DailySummary> {
  const response = await fetch("/api/summary/today");

  if (!response.ok) {
    throw new Error("Failed to fetch today's summary");
  }

  return response.json();
}



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

export async function getDailyActivity(
  day: string
): Promise<DailyActivityResponse> {
  const response = await fetch(
    `/api/activity/${encodeURIComponent(day)}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch daily activity");
  }

  return response.json();
}
