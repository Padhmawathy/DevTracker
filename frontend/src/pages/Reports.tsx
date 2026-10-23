
import { useEffect, useState } from "react";
import { apiFetch, getDailyReport, type DailySummary } from "../services/api";
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

  async function downloadMarkdown() {
    if (loading || !report) return;

    try {
      setError("");

      const response = await apiFetch(
        `/api/reports/${encodeURIComponent(selectedDate)}/download`
      );

      if (!response.ok) {
        throw new Error(`Report download failed: ${response.status}`);
      }

      const markdown = await response.text();

      if (markdown.trimStart().startsWith("<!doctype html") ||
          markdown.trimStart().startsWith("<html")) {
        throw new Error("The server returned HTML instead of Markdown.");
      }

      const blob = new Blob([markdown], {
        type: "text/markdown;charset=utf-8",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${selectedDate}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to download Markdown report."
      );
    }
  }
  const applications = report
    ? Object.entries(report.application_usage).sort(
        (a, b) => b[1] - a[1]
      )
    : [];

  const projects = report
    ? Object.entries(report.projects)
    : [];

  return (
    <div className="space-y-4">

      
    <div className="flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-center gap-4">
        <label
        htmlFor="report-date"
        className="flex items-center gap-2 text-sm text-[var(--dx-body)]"
        >
        <CalendarDays size={18} />
        Select date
        </label>

        <input
        id="report-date"
        type="date"
        value={selectedDate}
        onChange={(event) => setSelectedDate(event.target.value)}
        className="rounded-lg border border-[var(--dx-border-strong)] bg-[var(--dx-raised)] px-3 py-2 text-[var(--dx-heading)]"
        />
    </div>

   <button
      type="button"
      disabled={loading || !report}
      onClick={() => void downloadMarkdown()}
      className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-[var(--dx-accent-contrast)] ${
        loading || !report
          ? "cursor-not-allowed bg-[var(--dx-disabled)] opacity-50"
          : "bg-[var(--dx-accent)] hover:bg-[var(--dx-accent-hover)]"
      }`}
    >
      <Download size={18} />
      Download Markdown
    </button>
    </div>

      {loading && (
        <p className="text-[var(--dx-muted)]">
          Generating daily report...
        </p>
      )}

      {error && (
        <p role="alert" className="text-[var(--dx-danger)]">
          {error}
        </p>
      )}

      {!loading && report && (
        <>
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--dx-border)] bg-[var(--dx-border)] xl:grid-cols-4">
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
                  className="bg-[var(--dx-surface)] px-4 py-3"
                >
                  <div className="flex items-center gap-2 text-[var(--dx-muted)]">
                    <Icon size={15} />
                    <span className="text-[11px]">{item.label}</span>
                  </div>

                  <p className="mt-2 text-[16px] font-semibold">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </section>

          <section className="rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-6">
            <h2 className="mb-5 text-sm font-semibold">
              Application Usage
            </h2>

            {applications.length === 0 ? (
              <p className="text-sm text-[var(--dx-muted)]">
                No application activity recorded.
              </p>
            ) : (
              <div className="space-y-4">
                {applications.map(([name, seconds]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-4 border-b border-[var(--dx-border)] pb-3"
                  >
                    <span className="break-all text-sm text-[var(--dx-body)]">
                      {name}
                    </span>

                    <span className="shrink-0 text-sm font-medium text-[var(--dx-accent-text)]">
                      {formatDuration(seconds)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold">
              Project Work
            </h2>

            {projects.length === 0 ? (
              <div className="rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-6 text-[var(--dx-muted)]">
                No project check-ins recorded for this date.
              </div>
            ) : (
              projects.map(([name, details]) => (
                <article
                  key={name}
                  className="rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-6"
                >
                  <h3 className="text-sm font-semibold">
                    {name}
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {details.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-accent-soft)] px-2 py-1 text-xs text-[var(--dx-accent-text)]"
                      >
                        {category}
                      </span>
                    ))}
                  </div>

                  <h4 className="mt-5 text-sm font-medium text-[var(--dx-body)]">
                    Work recorded
                  </h4>

                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-[var(--dx-muted)]">
                    {details.work.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>

                  {details.blockers.length > 0 && (
                    <>
                      <h4 className="mt-5 text-sm font-medium text-[var(--dx-warning)]">
                        Blockers
                      </h4>

                      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-[var(--dx-warning)]">
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
