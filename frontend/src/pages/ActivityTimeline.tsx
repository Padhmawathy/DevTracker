
import { useEffect, useState } from "react";
import {
  getDailyActivity,
  type DailyActivityResponse,
} from "../services/api";

function getLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export default function ActivityTimeline() {
  const [selectedDate, setSelectedDate] = useState(
    getLocalDate()
  );

  const [data, setData] =
    useState<DailyActivityResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadActivity() {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const result = await getDailyActivity(selectedDate);

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load activity timeline.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadActivity();

    return () => controller.abort();
  }, [selectedDate]);

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm text-indigo-400">
          Developer Workspace
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Activity Timeline
        </h1>

        <p className="mt-2 text-slate-400">
          Explore your recorded application activity by date.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label
          htmlFor="activity-date"
          className="text-sm text-slate-300"
        >
          Select date
        </label>

        <input
          id="activity-date"
          type="date"
          value={selectedDate}
          onChange={(event) =>
            setSelectedDate(event.target.value)
          }
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white"
        />
      </div>

      {loading && (
        <p className="text-slate-400">
          Loading activity...
        </p>
      )}

      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && data && (
        <>
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Recorded activity groups
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {data.total_activities}
            </h2>
          </div>

          {data.activities.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
              No activity recorded for this date.
            </div>
          ) : (
            <div className="space-y-3">
              {data.activities.map((activity, index) => (
                <div
                  key={`${activity.id}-${index}`}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">
                      {activity.process_name}
                    </h3>

                    <span className="text-sm font-medium text-indigo-400">
                      {formatDuration(
                        activity.duration_seconds
                      )}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-400">
                    {formatTime(activity.started_at)}
                    {" → "}
                    {formatTime(activity.ended_at)}
                  </p>

                  {activity.window_title && (
                    <p className="mt-2 break-words text-xs text-slate-500">
                      {activity.window_title}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
