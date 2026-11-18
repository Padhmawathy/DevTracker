import { useEffect, useState } from "react";
import DateNav from "../components/DateNav";
import { todayIso } from "../lib/dates";
import { apiFetch, getDailyReport, type DailySummary } from "../services/api";

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
}

const TOP_APPS = 8;

export default function Reports() {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [report, setReport] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllApps, setShowAllApps] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      setLoading(true);
      setError("");
      setShowAllApps(false);
      try {
        const data = await getDailyReport(selectedDate);
        if (!cancelled) setReport(data);
      } catch {
        if (!cancelled) {
          setReport(null);
          setError("Unable to load the report.");
        }
      } finally {
        if (!cancelled) setLoading(false);
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
      const response = await apiFetch(`/api/reports/${encodeURIComponent(selectedDate)}/download`);
      if (!response.ok) throw new Error(`Report download failed: ${response.status}`);

      const markdown = await response.text();
      const head = markdown.trimStart();
      if (head.startsWith("<!doctype html") || head.startsWith("<html")) {
        throw new Error("The server returned HTML instead of Markdown.");
      }

      const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedDate}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export the report.");
    }
  }

  const applications = report
    ? Object.entries(report.application_usage).sort((a, b) => b[1] - a[1])
    : [];
  const maxApp = applications[0]?.[1] ?? 0;
  const visibleApps = showAllApps ? applications : applications.slice(0, TOP_APPS);
  const projects = report ? Object.entries(report.projects) : [];

  const stats = report
    ? [
        { label: "Tracked", value: formatDuration(report.total_tracked_seconds) },
        { label: "Sessions", value: String(report.activity_count) },
        { label: "Check-ins", value: String(report.checkin_count) },
        { label: "Projects", value: String(projects.length) },
      ]
    : [];

  const empty = report && report.total_tracked_seconds === 0 && projects.length === 0;

  return (
    <div className="mx-auto max-w-[880px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateNav value={selectedDate} onChange={setSelectedDate} />
        <button
          type="button"
          disabled={loading || !report}
          onClick={() => void downloadMarkdown()}
          className="ui-btn h-8 px-4 text-[13px] disabled:opacity-40"
        >
          Export Markdown
        </button>
      </div>

      {error && (
        <p role="alert" className="px-1 text-[13px] text-[var(--dx-danger)]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="px-1 text-[13px] text-[var(--ui-tertiary)]">Loading…</p>
      ) : !report ? null : empty ? (
        <div className="py-16 text-center">
          <p className="text-[15px] font-medium">Nothing recorded</p>
          <p className="mt-1 text-[13px] text-[var(--ui-secondary)]">
            There’s no tracked activity or check-ins for this day.
          </p>
        </div>
      ) : (
        <>
          <section className="ui-card grid grid-cols-2 !p-0 sm:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={[
                  "px-5 py-4",
                  i % 2 === 1 ? "border-l border-[var(--ui-hairline)]" : "",
                  i >= 2 ? "border-t border-[var(--ui-hairline)] sm:border-t-0" : "",
                  i === 2 ? "sm:border-l" : "",
                ].join(" ")}
              >
                <p className="text-[12px] text-[var(--ui-secondary)]">{s.label}</p>
                <p className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] tabular-nums">{s.value}</p>
              </div>
            ))}
          </section>

          {applications.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-[13px] font-medium text-[var(--ui-secondary)]">Apps</h2>
              <ul className="ui-card space-y-3.5 px-5 py-4">
                {visibleApps.map(([name, seconds]) => (
                  <li key={name}>
                    <div className="mb-1 flex items-baseline justify-between gap-4">
                      <span className="truncate text-[14px] text-[var(--dx-heading)]" title={name}>
                        {name}
                      </span>
                      <span className="shrink-0 text-[13px] tabular-nums text-[var(--ui-secondary)]">
                        {formatDuration(seconds)}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[var(--ui-fill-strong)]">
                      <div
                        className="h-full rounded-full bg-[var(--dx-accent)]"
                        style={{ width: `${maxApp ? (seconds / maxApp) * 100 : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
                {applications.length > TOP_APPS && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setShowAllApps((v) => !v)}
                      className="text-[13px] font-medium text-[var(--dx-accent-text)] hover:opacity-75"
                    >
                      {showAllApps ? "Show less" : `Show all ${applications.length}`}
                    </button>
                  </li>
                )}
              </ul>
            </section>
          )}

          {projects.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-[13px] font-medium text-[var(--ui-secondary)]">Projects</h2>
              <div className="ui-card divide-y divide-[var(--ui-hairline)] !p-0">
                {projects.map(([name, details]) => (
                  <article key={name} className="px-5 py-4">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[15px] font-semibold">{name}</span>
                      <span className="text-[12px] text-[var(--ui-secondary)]">{details.categories.join(" · ")}</span>
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {details.work.map((item, index) => (
                        <li key={index} className="flex gap-2.5 text-[14px] leading-relaxed text-[var(--dx-body)]">
                          <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[var(--ui-tertiary)]" />
                          <span className="whitespace-pre-wrap">{item}</span>
                        </li>
                      ))}
                      {details.blockers.map((item, index) => (
                        <li key={`b-${index}`} className="flex gap-2.5 text-[14px] leading-relaxed text-[var(--dx-warning)]">
                          <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[var(--dx-warning)]" />
                          <span className="whitespace-pre-wrap">Blocked: {item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
