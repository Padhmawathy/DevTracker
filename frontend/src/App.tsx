
import { useEffect, useRef, useState } from "react";
import TopNav, { type Page } from "./components/TopNav";
import { getCurrent } from "@tauri-apps/plugin-deep-link";
import ActivityTimeline from "./pages/ActivityTimeline";
import CheckIns from "./pages/CheckIns";
import Calendar from "./pages/Calendar";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { apiFetch, submitReminderAction, getDeveloperProfile, type DeveloperProfile } from "./services/api";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
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
  calendar: {
    title: "Job calendar",
    subtitle: "Log work and posts for each job, day by day.",
    eyebrow: "CALENDAR",
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
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="ui-card px-5 py-4">
      <p className="text-[12px] font-medium text-[var(--ui-secondary)]">{label}</p>
      <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.03em] tabular-nums text-[var(--dx-heading)]">
        {value}
      </p>
      <p className="mt-0.5 text-[12px] text-[var(--ui-tertiary)]">{note}</p>
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
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--dx-heading)]">
          {title}
        </h2>
        <p className="mt-0.5 text-[12px] text-[var(--ui-secondary)]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function TextLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] font-medium text-[var(--dx-accent-text)] hover:opacity-75"
    >
      {children}
    </button>
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
    <div className="flex min-h-[180px] flex-col items-center justify-center px-6 pb-6 text-center">
      <p className="text-[14px] font-medium text-[var(--dx-heading)]">{title}</p>
      <p className="mt-1 max-w-[280px] text-[12px] leading-5 text-[var(--ui-secondary)]">
        {description}
      </p>
    </div>
  );
}
const DEVELOPER_ROLE_LABELS: Record<string, string> = {
  frontend: "Frontend Developer",
  backend: "Backend Developer",
  fullstack: "Full-stack Developer",
  mobile: "Mobile Developer",
  devops: "DevOps Engineer",
};

function getDeveloperRoleLabel(role: string): string {
  return DEVELOPER_ROLE_LABELS[role] ?? role;
}

function Overview({
  onNavigate,
}: {
  onNavigate: (page: Page) => void;
}) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);

  useEffect(() => {
    let mounted = true;

    getDeveloperProfile()
      .then((data) => {
        if (mounted) setProfile(data);
      })
      .catch((error) => {
        console.error("Unable to load developer profile:", error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    async function loadSummary(initialLoad = false) {
      const maxAttempts = initialLoad ? 10 : 1;
      const retryDelayMs = 1000;

      try {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (controller.signal.aborted) return;

          try {
            const response = await apiFetch("/api/summary/today", {
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const data: DailySummary = await response.json();

            if (controller.signal.aborted) return;

            setSummary(data);
            setError("");
            return;
          } catch (err) {
            if (controller.signal.aborted) return;

            if (
              err instanceof Error &&
              err.message.startsWith("HTTP ")
            ) {
              throw err;
            }

            if (attempt === maxAttempts) {
              throw err;
            }

            await new Promise<void>((resolve) => {
              setTimeout(resolve, retryDelayMs);
            });
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          if (initialLoad) {
            setError("Could not load today's summary.");
          } else {
            console.warn("Could not refresh today's summary.");
          }
        }
      } finally {
        if (initialLoad && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

  async function refreshLoop(initialLoad: boolean) {
    await loadSummary(initialLoad);

    if (!controller.signal.aborted) {
      refreshTimer = setTimeout(() => {
        void refreshLoop(false);
      }, 30000);
    }
  }

  void refreshLoop(true);

  return () => {
    controller.abort();

    if (refreshTimer !== undefined) {
      clearTimeout(refreshTimer);
    }
  };
}, []);


  const usage = Object.entries(summary?.application_usage ?? {})
    .sort((a, b) => b[1] - a[1]);

  const maxUsage = usage.length > 0 ? usage[0][1] : 0;
  const projects = Object.keys(summary?.projects ?? {});
  const goalMinutes = profile?.daily_focus_goal_minutes ?? 480;
  const goalSeconds = goalMinutes * 60;
  const trackedSeconds = summary?.total_tracked_seconds ?? 0;

  const focusProgress = goalSeconds > 0
    ? Math.min(100, (trackedSeconds / goalSeconds) * 100)
    : 0;

  const goalHours = goalMinutes / 60;
  const name = profile?.display_name?.trim();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.025em] text-[var(--dx-heading)]">
            {name ? `${greeting}, ${name}.` : `${greeting}.`}
          </h2>
          <p className="mt-0.5 text-[14px] text-[var(--ui-secondary)]">
            {profile?.role?.trim()
              ? `${getDeveloperRoleLabel(profile.role)} · Here’s your day so far.`
              : "Here’s your day so far."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("checkins")}
          className="ui-btn-primary h-9 px-4"
        >
          <span className="text-[17px] leading-none">+</span>
          New Check-in
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="ui-card flex items-center gap-3 px-4 py-3 text-[13px] text-[var(--dx-heading)]"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--dx-danger)]" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="ui-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-medium text-[var(--ui-secondary)]">Daily focus goal</p>
              <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.03em] tabular-nums">
                {formatDuration(trackedSeconds)}
                <span className="ml-2 text-[15px] font-normal tracking-normal text-[var(--ui-secondary)]">
                  of {goalHours.toLocaleString()}h
                </span>
              </p>
            </div>
            <span className="text-[15px] font-semibold tabular-nums text-[var(--dx-accent-text)]">
              {Math.round(focusProgress)}%
            </span>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--ui-fill-strong)]">
            <div
              className="h-full rounded-full bg-[var(--dx-accent)] transition-all duration-700 ease-out"
              style={{ width: `${focusProgress}%` }}
            />
          </div>

          <p className="mt-3 text-[12px] text-[var(--ui-tertiary)]">
            Based on today’s recorded activity.
          </p>
        </section>

        {profile && (
          <section className="ui-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-[var(--ui-secondary)]">Your stack</p>
                <p className="mt-1.5 text-[17px] font-semibold tracking-[-0.02em]">
                  {getDeveloperRoleLabel(profile.role)}
                </p>
              </div>
              <TextLink onClick={() => onNavigate("settings")}>Edit</TextLink>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {[profile.primary_language, profile.primary_editor]
                .filter((value) => value?.trim())
                .map((value, index) => (
                  <span
                    key={`${index}-${value}`}
                    className="rounded-full bg-[var(--ui-fill-strong)] px-3 py-1 text-[12px] font-medium text-[var(--dx-body)]"
                  >
                    {value}
                  </span>
                ))}
            </div>
          </section>
        )}
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric
          label="Tracked time"
          value={loading ? "—" : formatDuration(summary?.total_tracked_seconds ?? 0)}
          note="Today"
        />
        <Metric
          label="Activities"
          value={loading ? "—" : summary?.activity_count ?? 0}
          note="Sessions"
        />
        <Metric
          label="Check-ins"
          value={loading ? "—" : summary?.checkin_count ?? 0}
          note="Journal entries"
        />
        <Metric
          label="Projects"
          value={loading ? "—" : projects.length}
          note="Documented"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="ui-card overflow-hidden">
          <SectionHeading
            title="Application usage"
            subtitle="Where your time went today"
            action={<TextLink onClick={() => onNavigate("activity")}>Timeline</TextLink>}
          />

          {usage.length === 0 ? (
            <EmptyState
              title={loading ? "Loading activity…" : "No activity yet"}
              description="Application usage appears here once tracking has data."
            />
          ) : (
            <ul className="space-y-4 px-5 pb-5 pt-1">
              {usage.slice(0, 7).map(([app, seconds]) => {
                const width = maxUsage > 0 ? (seconds / maxUsage) * 100 : 0;

                return (
                  <li key={app}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="truncate text-[13px] text-[var(--dx-heading)]" title={app}>
                        {app}
                      </span>
                      <span className="shrink-0 text-[12px] tabular-nums text-[var(--ui-secondary)]">
                        {formatDuration(seconds)}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[var(--ui-fill-strong)]">
                      <div
                        className="h-full rounded-full bg-[var(--dx-accent)]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="ui-card overflow-hidden">
          <SectionHeading
            title="Today’s projects"
            subtitle="From your work journal"
            action={<TextLink onClick={() => onNavigate("checkins")}>Journal</TextLink>}
          />

          {projects.length === 0 ? (
            <EmptyState
              title={loading ? "Loading projects…" : "Nothing documented yet"}
              description="Add a check-in to connect your activity to the work you’re doing."
            />
          ) : (
            <ul className="px-2 pb-2">
              {projects.map((project) => (
                <li key={project}>
                  <button
                    type="button"
                    onClick={() => onNavigate("checkins")}
                    className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition hover:bg-[var(--ui-fill)]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--dx-accent-soft)] text-[12px] font-semibold text-[var(--dx-accent-text)]">
                      {project.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--dx-heading)]">
                      {project}
                    </span>
                    <span className="text-[var(--ui-tertiary)]" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ui-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-[14px] font-medium text-[var(--dx-heading)]">End-of-day report</p>
          <p className="mt-0.5 text-[12px] text-[var(--ui-secondary)]">
            Review your tracked work and export a summary.
          </p>
        </div>

        <button type="button" onClick={() => onNavigate("reports")} className="ui-btn h-8 px-4">
          View Reports
        </button>
      </section>
    </div>
  );
}

function getPageFromUrl(): Page {
  const params = new URLSearchParams(window.location.search);
  const requestedPage = params.get("page");

  const validPages: Page[] = [
    "overview",
    "activity",
    "checkins",
    "calendar",
    "reports",
    "settings",
  ];

  if (
    requestedPage &&
    validPages.includes(requestedPage as Page)
  ) {
    return requestedPage as Page;
  }

  return "overview";
}

export default function App() {
  const [activePage, setActivePage] = useState<Page>(getPageFromUrl());

  const currentPage = PAGE_INFO[activePage];
  const fitsWindow = activePage === "calendar";

  function navigate(page: Page) {
    setActivePage(page);

    const url = new URL(window.location.href);
    url.searchParams.set("page", page);

    window.history.pushState({}, "", url);
  }

  // Prevent the same notification being processed twice if Windows forwards
  // it through more than one activation path in quick succession.
  const recentReminderActions = useRef(new Map<string, number>());

  function handleIncomingDeepLinks(urls: string[]) {
    for (const rawUrl of urls) {
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        continue;
      }

      if (url.protocol !== "devtrack:" || url.search || url.hash ||
          url.username || url.password || url.port) {
        continue;
      }

      if (url.hostname === "open" && url.pathname === "/checkins") {
        navigate("checkins");
        continue;
      }

      const action = url.hostname;
      const reminderId = url.pathname.slice(1);
      if ((action !== "snooze" && action !== "skip") ||
          !/^[0-9a-f]{32}$/.test(reminderId)) {
        continue;
      }

      const key = `${action}:${reminderId}`;
      const now = Date.now();
      const lastSeen = recentReminderActions.current.get(key);
      if (lastSeen !== undefined && now - lastSeen < 2000) continue;
      recentReminderActions.current.set(key, now);
      for (const [oldKey, when] of recentReminderActions.current) {
        if (now - when > 2000) recentReminderActions.current.delete(oldKey);
      }

      void submitReminderAction(action, reminderId).catch((error) => {
        recentReminderActions.current.delete(key);
        console.error("Reminder action failed:", error);
      });
    }
  }

  function renderPage() {
    switch (activePage) {
      case "overview":
        return <Overview onNavigate={navigate} />;
      case "activity":
        return <ActivityTimeline />;
      case "checkins":
        return <CheckIns />;
      case "calendar":
        return <Calendar />;
      case "reports":
        return <Reports />;
      case "settings":
        return <Settings />;
      default:
        return <Overview onNavigate={navigate} />;
    }
  }

  useEffect(() => {
    function handlePopState() {
      setActivePage(getPageFromUrl());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    // When already running, the Rust single-instance callback forwards URLs.
    void listen<string>("devtrack-deep-link", (event) => {
      if (!disposed) handleIncomingDeepLinks([event.payload]);
    }).then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    }).catch(console.error);

    // When launched from a deep link while not already running, read the
    // initial URL. Avoid a second onOpenUrl listener for the same activation.
    void getCurrent().then((urls) => {
      if (!disposed && urls) handleIncomingDeepLinks(urls);
    }).catch(console.error);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[var(--ui-page)] font-sans text-[var(--dx-heading)]">
      <TopNav activePage={activePage} onNavigate={navigate} />

        {/* The Calendar page fits the window on desktop: no page scroll,
            each of its sections scrolls on its own. */}
        <main
          className={[
            "min-h-0 flex-1 overflow-y-auto",
            fitsWindow ? "lg:overflow-hidden" : "",
          ].join(" ")}
        >
          <div
            className={[
              "mx-auto w-full max-w-[1280px] px-4 pt-6 sm:px-8",
              fitsWindow
                ? "pb-16 sm:pt-8 lg:flex lg:h-full lg:flex-col lg:pb-6"
                : "pb-16 sm:pt-10",
            ].join(" ")}
          >
            <div
              className={[
                "flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-2",
                fitsWindow ? "mb-6" : "mb-8",
              ].join(" ")}
            >
              <div>
                <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[34px]">
                  {currentPage.title}
                </h1>
                <p className="mt-1 text-[15px] text-[var(--ui-secondary)]">
                  {currentPage.subtitle}
                </p>
              </div>

              <p className="text-[13px] font-medium text-[var(--ui-secondary)]">
                {getTodayLabel()}
              </p>
            </div>

            <div className={fitsWindow ? "lg:min-h-0 lg:flex-1" : ""}>
              {renderPage()}
            </div>
          </div>
        </main>
    </div>
  );
}
