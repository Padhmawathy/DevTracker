
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

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label
          htmlFor="activity-date"
          className="text-sm text-[var(--dx-body)]"
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
          className="ui-input w-auto"
        />
      </div>

      {loading && (
        <p className="text-[var(--dx-muted)]">
          Loading activity...
        </p>
      )}

      {error && (
        <p role="alert" className="text-[var(--dx-danger)]">
          {error}
        </p>
      )}

      {!loading && !error && data && (
        <>
          <div className="ui-card mb-5 px-5 py-4">
            <p className="text-sm text-[var(--dx-muted)]">
              Recorded activity groups
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {data.total_activities}
            </h2>
          </div>

          {data.activities.length === 0 ? (
            <div className="ui-card p-6 text-[var(--dx-muted)]">
              No activity recorded for this date.
            </div>
          ) : (
            <div className="ui-card overflow-hidden divide-y divide-[var(--dx-border)]">
              {data.activities.map((activity, index) => (
                <div
                  key={`${activity.id}-${index}`}
                  className="px-5 py-4 transition hover:bg-[var(--dx-hover)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-[13px] font-medium text-[var(--dx-heading)]">
                      {activity.display_name || activity.process_name}
                    </h3>

                    <span className="text-[12px] font-medium tabular-nums text-[var(--dx-accent-text)]">
                      {formatDuration(
                        activity.duration_seconds
                      )}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[var(--dx-muted)]">
                    {formatTime(activity.started_at)}
                    {" → "}
                    {formatTime(activity.ended_at)}
                  </p>

                  {activity.window_title && (
                    <p className="mt-2 break-words text-xs text-[var(--dx-muted)]">
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
