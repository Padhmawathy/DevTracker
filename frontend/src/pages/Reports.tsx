
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
    <div className="space-y-6">

      
    <div className="flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-center gap-4">
        <label
        htmlFor="report-date"
        className="flex items-center gap-2 text-sm text-[#c3ccc5]"
        >
        <CalendarDays size={18} />
        Select date
        </label>

        <input
        id="report-date"
        type="date"
        value={selectedDate}
        onChange={(event) => setSelectedDate(event.target.value)}
        className="rounded-lg border border-[#39413d] bg-[#202424] px-3 py-2 text-[#f0f2ee] [color-scheme:dark]"
        />
    </div>

    <a
        href={`/api/reports/${encodeURIComponent(selectedDate)}/download`}
        download={`${selectedDate}.md`}
        aria-disabled={loading || !report}
        onClick={(event) => {
        if (loading || !report) event.preventDefault();
        }}
        className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-[#17231b] ${
        loading || !report
            ? "cursor-not-allowed bg-[#333b38] opacity-50"
            : "bg-[#a7c9b4] hover:bg-[#bdd9c7]"
        }`}
    >
        <Download size={18} />
        Download Markdown
    </a>
    </div>

      {loading && (
        <p className="text-[#929c95]">
          Generating daily report...
        </p>
      )}

      {error && (
        <p role="alert" className="text-[#f1aaa5]">
          {error}
        </p>
      )}

      {!loading && report && (
        <>
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#2b2f30] bg-[#2b2f30] xl:grid-cols-4">
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
                  className="bg-[#1c1f20] p-5"
                >
                  <div className="flex items-center gap-2 text-[#929c95]">
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

          <section className="rounded-lg border border-[#2b2f30] bg-[#1c1f20] p-6">
            <h2 className="mb-5 text-sm font-semibold">
              Application Usage
            </h2>

            {applications.length === 0 ? (
              <p className="text-sm text-[#929c95]">
                No application activity recorded.
              </p>
            ) : (
              <div className="space-y-4">
                {applications.map(([name, seconds]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-4 border-b border-[#2b2f30] pb-3"
                  >
                    <span className="break-all text-sm text-[#c3ccc5]">
                      {name}
                    </span>

                    <span className="shrink-0 text-sm font-medium text-[#aacbb6]">
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
              <div className="rounded-lg border border-[#2b2f30] bg-[#1c1f20] p-6 text-[#929c95]">
                No project check-ins recorded for this date.
              </div>
            ) : (
              projects.map(([name, details]) => (
                <article
                  key={name}
                  className="rounded-lg border border-[#2b2f30] bg-[#1c1f20] p-6"
                >
                  <h3 className="text-sm font-semibold">
                    {name}
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {details.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-md border border-[#3a4a40] bg-[#a7c9b4]/10 px-2 py-1 text-xs text-[#c4d9ca]"
                      >
                        {category}
                      </span>
                    ))}
                  </div>

                  <h4 className="mt-5 text-sm font-medium text-[#c3ccc5]">
                    Work recorded
                  </h4>

                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-[#929c95]">
                    {details.work.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>

                  {details.blockers.length > 0 && (
                    <>
                      <h4 className="mt-5 text-sm font-medium text-[#e6bc82]">
                        Blockers
                      </h4>

                      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-[#d8ba8c]">
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
