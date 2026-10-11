
import { useEffect, useState } from "react";
import { getDailyReport, type DailySummary } from "../services/api";
import {
  CalendarDays,
  Clock3,
  FileText,
  FolderKanban,
  Download,
} from "lucide-react";

function localDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remaining}s`;
  return `${remaining}s`;
}

export default function Reports() {
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [report, setReport] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      setLoading(true);
      setError("");
      setReport(null);

      try {
        const data = await getDailyReport(selectedDate);

        if (!cancelled) {
          setReport(data);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load the daily report.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const applications = report
    ? Object.entries(report.application_usage).sort(
        (a, b) => b[1] - a[1]
      )
    : [];

  const projects = report
    ? Object.entries(report.projects)
    : [];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-indigo-400">
          Developer Workspace
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Daily Reports
        </h1>

        <p className="mt-2 text-slate-400">
          Review your development activity and daily progress.
        </p>
      </header>

      
    <div className="flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-center gap-4">
        <label
        htmlFor="report-date"
        className="flex items-center gap-2 text-sm text-slate-300"
        >
        <CalendarDays size={18} />
        Select date
        </label>

        <input
        id="report-date"
        type="date"
        value={selectedDate}
        onChange={(event) => setSelectedDate(event.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white"
        />
    </div>

    <a
        href={`/api/reports/${encodeURIComponent(selectedDate)}/download`}
        download={`${selectedDate}.md`}
        aria-disabled={loading || !report}
        onClick={(event) => {
        if (loading || !report) event.preventDefault();
        }}
        className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white ${
        loading || !report
            ? "cursor-not-allowed bg-slate-700 opacity-50"
            : "bg-indigo-600 hover:bg-indigo-500"
        }`}
    >
        <Download size={18} />
        Download Markdown
    </a>
    </div>

      {loading && (
        <p className="text-slate-400">
          Generating daily report...
        </p>
      )}

      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}

      {!loading && report && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Tracked Time",
                value: formatDuration(report.total_tracked_seconds),
                icon: Clock3,
              },
              {
                label: "Activities",
                value: String(report.activity_count),
                icon: FileText,
              },
              {
                label: "Check-ins",
                value: String(report.checkin_count),
                icon: FileText,
              },
              {
                label: "Projects",
                value: String(projects.length),
                icon: FolderKanban,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="flex items-center gap-2 text-slate-400">
                    <Icon size={18} />
                    <span className="text-sm">{item.label}</span>
                  </div>

                  <p className="mt-3 text-2xl font-bold">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-5 text-lg font-semibold">
              Application Usage
            </h2>

            {applications.length === 0 ? (
              <p className="text-sm text-slate-400">
                No application activity recorded.
              </p>
            ) : (
              <div className="space-y-4">
                {applications.map(([name, seconds]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3"
                  >
                    <span className="break-all text-sm text-slate-300">
                      {name}
                    </span>

                    <span className="shrink-0 text-sm font-medium text-indigo-400">
                      {formatDuration(seconds)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              Project Work
            </h2>

            {projects.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
                No project check-ins recorded for this date.
              </div>
            ) : (
              projects.map(([name, details]) => (
                <article
                  key={name}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-6"
                >
                  <h3 className="text-lg font-semibold">
                    {name}
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {details.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-md bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300"
                      >
                        {category}
                      </span>
                    ))}
                  </div>

                  <h4 className="mt-5 text-sm font-medium text-slate-300">
                    Work recorded
                  </h4>

                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-400">
                    {details.work.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>

                  {details.blockers.length > 0 && (
                    <>
                      <h4 className="mt-5 text-sm font-medium text-amber-400">
                        Blockers
                      </h4>

                      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-amber-300">
                        {details.blockers.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </article>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
