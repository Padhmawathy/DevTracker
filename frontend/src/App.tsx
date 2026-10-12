
import { useEffect, useState } from "react";
import Sidebar, { type Page } from "./components/Sidebar";

import ActivityTimeline from "./pages/ActivityTimeline";
import CheckIns from "./pages/CheckIns";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

type DailySummary = {
  date: string;
  total_tracked_seconds: number;
  activity_count: number;
  checkin_count: number;
  application_usage: Record<string, number>;
  projects: Record<string, unknown>;
};

const PAGE_INFO: Record<
  Page,
  { title: string; subtitle: string; eyebrow: string }
> = {
  overview: {
    title: "Overview",
    subtitle: "A clear picture of your development day.",
    eyebrow: "YOUR WORKSPACE",
  },
  activity: {
    title: "Activity timeline",
    subtitle: "A chronological record of your working sessions.",
    eyebrow: "ACTIVITY",
  },
  checkins: {
    title: "Work journal",
    subtitle: "Capture progress, decisions and blockers.",
    eyebrow: "CHECK-INS",
  },
  reports: {
    title: "Daily reports",
    subtitle: "Turn recorded activity into a useful work summary.",
    eyebrow: "REPORTS",
  },
  settings: {
    title: "Settings",
    subtitle: "Configure tracking and control your privacy.",
    eyebrow: "PREFERENCES",
  },
};

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return total > 0 ? `${total}s` : "0m";
}

function getTodayLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function Metric({
  label,
  value,
  note,
  index,
}: {
  label: string;
  value: string | number;
  note: string;
  index: string;
}) {
  return (
    <div className="min-w-0 border-b border-[#2a2d2e] px-5 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-[#8c9495]">{label}</span>
        <span className="font-mono text-[10px] text-[#51595a]">
          {index}
        </span>
      </div>

      <p className="mt-4 text-[29px] font-semibold tracking-[-0.055em] text-[#eeeFEB]">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-[#686f70]">{note}</p>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#292d2e] px-5 py-4">
      <div>
        <h2 className="text-[13px] font-semibold text-[#e9ece9]">
          {title}
        </h2>
        <p className="mt-1 text-[11px] text-[#788082]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-[#34393a] bg-[#222627]">
        <div className="grid grid-cols-2 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-[2px] bg-[#707c78]"
            />
          ))}
        </div>
      </div>

      <p className="text-[13px] font-medium text-[#d3d8d5]">
        {title}
      </p>
      <p className="mt-2 max-w-[260px] text-[11px] leading-5 text-[#747d7c]">
        {description}
      </p>
    </div>
  );
}

function Overview({
  onNavigate,
}: {
  onNavigate: (page: Page) => void;
}) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadSummary() {
      try {
        const response = await fetch("/api/summary/today", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: DailySummary = await response.json();
        setSummary(data);
        setError("");
      } catch (err) {
        if (!controller.signal.aborted) {
          setError("Could not load today's summary.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadSummary();

    return () => controller.abort();
  }, []);

  const usage = Object.entries(summary?.application_usage ?? {})
    .sort((a, b) => b[1] - a[1]);

  const maxUsage = usage.length > 0 ? usage[0][1] : 0;
  const projects = Object.keys(summary?.projects ?? {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#91b5a1]">
            DAILY WORK SNAPSHOT
          </p>

          <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-[#f0f1ed]">
            Your day, at a glance.
          </h2>

          <p className="mt-1 text-[12px] text-[#858d8d]">
            Activity, progress and context in one place.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("checkins")}
          className="inline-flex items-center gap-2 rounded-md border border-[#9cbba8] bg-[#a7c9b4] px-4 py-2.5 text-[12px] font-semibold text-[#152019] transition hover:bg-[#bdd9c7]"
        >
          <span className="text-lg leading-none">+</span>
          New check-in
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[#704847] bg-[#352525] px-4 py-3 text-[12px] text-[#e9aaa7]"
        >
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#2b2f30] bg-[#1c1f20] sm:grid-cols-4">
        <Metric
          label="Tracked time"
          value={
            loading
              ? "—"
              : formatDuration(summary?.total_tracked_seconds ?? 0)
          }
          note="Recorded today"
          index="01"
        />
        <Metric
          label="Activities"
          value={loading ? "—" : summary?.activity_count ?? 0}
          note="Tracked sessions"
          index="02"
        />
        <Metric
          label="Check-ins"
          value={loading ? "—" : summary?.checkin_count ?? 0}
          note="Journal entries"
          index="03"
        />
        <Metric
          label="Projects"
          value={loading ? "—" : projects.length}
          note="Documented today"
          index="04"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <section className="overflow-hidden rounded-lg border border-[#2b2f30] bg-[#1c1f20]">
          <SectionHeading
            title="Application usage"
            subtitle="Where your tracked time went today"
            action={
              <button
                type="button"
                onClick={() => onNavigate("activity")}
                className="text-[11px] font-medium text-[#a5c9b4] hover:text-[#c9e3d1]"
              >
                View timeline →
              </button>
            }
          />

          {usage.length === 0 ? (
            <EmptyState
              title={loading ? "Loading activity…" : "No activity yet"}
              description="Your application usage will appear here once tracking data is available."
            />
          ) : (
            <div className="space-y-5 p-5">
              {usage.slice(0, 7).map(([app, seconds]) => {
                const width = maxUsage > 0
                  ? (seconds / maxUsage) * 100
                  : 0;

                return (
                  <div key={app}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="h-2 w-2 shrink-0 rounded-[2px] bg-[#9eb7a8]" />
                        <span
                          className="truncate text-[12px] text-[#d7dcda]"
                          title={app}
                        >
                          {app}
                        </span>
                      </div>

                      <span className="shrink-0 font-mono text-[11px] text-[#a1a9a8]">
                        {formatDuration(seconds)}
                      </span>
                    </div>

                    <div className="h-[5px] overflow-hidden rounded-full bg-[#2c3231]">
                      <div
                        className="h-full rounded-full bg-[#91b09d]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-[#2b2f30] bg-[#1c1f20]">
          <SectionHeading
            title="Today's projects"
            subtitle="Projects captured in your work journal"
            action={
              <button
                type="button"
                onClick={() => onNavigate("checkins")}
                className="text-[11px] font-medium text-[#a5c9b4] hover:text-[#c9e3d1]"
              >
                Open journal →
              </button>
            }
          />

          {projects.length === 0 ? (
            <EmptyState
              title={loading ? "Loading projects…" : "Nothing documented yet"}
              description="Add a check-in to connect your activity to the work you're doing."
            />
          ) : (
            <div className="divide-y divide-[#2b2f30]">
              {projects.map((project, index) => (
                <button
                  key={project}
                  type="button"
                  onClick={() => onNavigate("checkins")}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-[#232728]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#37413c] bg-[#29332d] font-mono text-[11px] text-[#bdd1c2]">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-[#e1e5e0]">
                      {project}
                    </p>
                    <p className="mt-1 text-[10px] text-[#79827d]">
                      Work journal project
                    </p>
                  </div>

                  <span className="text-[#687570]">→</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#2b2f30] bg-[#1c1f20] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#3a403d] bg-[#29312d]">
            <span className="font-mono text-[12px] text-[#b1c9ba]">
              {"</>"}
            </span>
          </div>

          <div>
            <p className="text-[12px] font-medium text-[#e0e5df]">
              End-of-day report
            </p>
            <p className="mt-1 text-[11px] text-[#7f8884]">
              Review your tracked work and export a summary.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("reports")}
          className="rounded-md border border-[#424847] px-3 py-2 text-[11px] font-medium text-[#d6dfd9] transition hover:bg-[#2c3430]"
        >
          View reports →
        </button>
      </section>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState<Page>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentPage = PAGE_INFO[activePage];

  function navigate(page: Page) {
    setActivePage(page);
    setMobileOpen(false);
  }

  function renderPage() {
    switch (activePage) {
      case "overview":
        return <Overview onNavigate={navigate} />;
      case "activity":
        return <ActivityTimeline />;
      case "checkins":
        return <CheckIns />;
      case "reports":
        return <Reports />;
      case "settings":
        return <Settings />;
      default:
        return <Overview onNavigate={navigate} />;
    }
  }

  return (
    <div className="flex min-h-screen bg-[#17191a] font-sans text-[#e7eae6] lg:h-screen lg:overflow-hidden">
      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] shrink-0 items-center justify-between gap-4 border-b border-[#2a2d2e] bg-[#191b1c] px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md border border-[#343839] p-2 text-[#aeb6b1] lg:hidden"
              aria-label="Open navigation"
            >
              <span className="block h-[2px] w-4 bg-current" />
              <span className="mt-1 block h-[2px] w-4 bg-current" />
              <span className="mt-1 block h-[2px] w-4 bg-current" />
            </button>

            <div className="min-w-0">
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[#777f7d]">
                DEVTRACKER / {currentPage.eyebrow}
              </p>

              <h1 className="mt-1 truncate text-[16px] font-semibold tracking-[-0.035em] text-[#f1f2ed]">
                {currentPage.title}
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="hidden items-center gap-2 text-[11px] text-[#969e9b] md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8fb79b]" />
              Private workspace
            </div>

            <div className="h-5 w-px bg-[#343839]" />

            <span className="font-mono text-[10px] text-[#7e8784]">
              PERSONAL BETA
            </span>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#2b2f30] pb-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#92b9a3]">
                  {currentPage.eyebrow}
                </p>

                <h2 className="mt-3 text-[25px] font-semibold tracking-[-0.05em] text-[#f0f2ee] sm:text-[30px]">
                  {currentPage.title}
                </h2>

                <p className="mt-2 text-[12px] text-[#858e8b]">
                  {currentPage.subtitle}
                </p>
              </div>

              <div className="rounded-md border border-[#333939] bg-[#202424] px-3 py-2 font-mono text-[11px] text-[#a2aca7]">
                {getTodayLabel()}
              </div>
            </div>

            {renderPage()}

            <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#292d2d] py-5">
              <p className="font-mono text-[10px] text-[#596360]">
                DEVTRACKER — AUTOMATIC WORK JOURNAL
              </p>

              <p className="text-[10px] text-[#596360]">
                Built for developers. Private by default.
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
