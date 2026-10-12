
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
          className="text-sm text-[#c3ccc5]"
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
          className="rounded-lg border border-[#39413d] bg-[#202424] px-3 py-2 text-[#f0f2ee] [color-scheme:dark]"
        />
      </div>

      {loading && (
        <p className="text-[#929c95]">
          Loading activity...
        </p>
      )}

      {error && (
        <p role="alert" className="text-[#f1aaa5]">
          {error}
        </p>
      )}

      {!loading && !error && data && (
        <>
          <div className="mb-5 rounded-lg border border-[#2b2f30] bg-[#1c1f20] px-5 py-4">
            <p className="text-sm text-[#929c95]">
              Recorded activity groups
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {data.total_activities}
            </h2>
          </div>

          {data.activities.length === 0 ? (
            <div className="rounded-lg border border-[#2b2f30] bg-[#1c1f20] p-6 text-[#929c95]">
              No activity recorded for this date.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#2b2f30] bg-[#1c1f20] divide-y divide-[#2b2f30]">
              {data.activities.map((activity, index) => (
                <div
                  key={`${activity.id}-${index}`}
                  className="px-5 py-4 transition hover:bg-[#242829]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-[13px] font-medium text-[#edf0eb]">
                      {activity.process_name}
                    </h3>

                    <span className="font-mono text-[12px] font-medium text-[#aacbb6]">
                      {formatDuration(
                        activity.duration_seconds
                      )}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[#929c95]">
                    {formatTime(activity.started_at)}
                    {" → "}
                    {formatTime(activity.ended_at)}
                  </p>

                  {activity.window_title && (
                    <p className="mt-2 break-words text-xs text-[#738078]">
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
