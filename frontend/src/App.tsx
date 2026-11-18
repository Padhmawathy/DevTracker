
import { useEffect, useRef, useState } from "react";
import TopNav, { type Page } from "./components/TopNav";
import JobMark from "./components/JobMark";
import { getCurrent } from "@tauri-apps/plugin-deep-link";
import ActivityTimeline from "./pages/ActivityTimeline";
import CheckIns from "./pages/CheckIns";
import Calendar from "./pages/Calendar";
import Tasks from "./pages/Tasks";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { apiFetch, submitReminderAction, getDeveloperProfile, getTasks, type DeveloperProfile, type Task } from "./services/api";
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

const PAGE_TITLES: Record<Page, string> = {
  overview: "Overview",
  tasks: "Tasks",
  activity: "Activity",
  checkins: "Check-ins",
  calendar: "Calendar",
  reports: "Reports",
  settings: "Settings",
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

function CardHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--dx-heading)]">{title}</h2>
      <button
        type="button"
        onClick={onAction}
        className="text-[13px] font-medium text-[var(--dx-accent-text)] hover:opacity-75"
      >
        {action}
      </button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 pb-6 pt-3 text-[13px] text-[var(--ui-tertiary)]">{children}</p>;
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
  const [tasks, setTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    let mounted = true;

    getDeveloperProfile()
      .then((data) => {
        if (mounted) setProfile(data);
      })
      .catch((error) => {
        console.error("Unable to load developer profile:", error);
      });

    getTasks()
      .then((data) => {
        if (mounted) setTasks(data);
      })
      .catch(() => {
        if (mounted) setTasks([]);
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

            if (err instanceof Error && err.message.startsWith("HTTP ")) {
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
            setError("Could not load today’s summary.");
          } else {
            console.warn("Could not refresh today’s summary.");
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

  const usage = Object.entries(summary?.application_usage ?? {}).sort((a, b) => b[1] - a[1]);
  const maxUsage = usage.length > 0 ? usage[0][1] : 0;
  const projectCount = Object.keys(summary?.projects ?? {}).length;

  const goalMinutes = profile?.daily_focus_goal_minutes ?? 480;
  const trackedSeconds = summary?.total_tracked_seconds ?? 0;
  const focusProgress = goalMinutes > 0 ? Math.min(100, (trackedSeconds / (goalMinutes * 60)) * 100) : 0;

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const dueTasks = (tasks ?? []).filter((t) => t.status !== "done" && t.due_date && t.due_date <= todayKey);

  const name = profile?.display_name?.trim();
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const stats = [
    `${summary?.activity_count ?? 0} sessions`,
    `${summary?.checkin_count ?? 0} check-ins`,
    `${projectCount} ${projectCount === 1 ? "project" : "projects"}`,
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-[var(--ui-secondary)]">{getTodayLabel()}</p>
          <h1 className="mt-0.5 text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[34px]">
            {name ? `${greeting}, ${name}` : greeting}
          </h1>
        </div>
        <button type="button" onClick={() => onNavigate("checkins")} className="ui-btn-primary h-9 px-4">
          New check-in
        </button>
      </header>

      {error && (
        <p role="alert" className="text-[13px] text-[var(--dx-danger)]">
          {error}
        </p>
      )}

      <section className="ui-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-[34px] font-semibold leading-none tracking-[-0.035em] tabular-nums">
            {loading ? "—" : formatDuration(trackedSeconds)}
            <span className="ml-2 text-[15px] font-normal tracking-normal text-[var(--ui-secondary)]">
              of {(goalMinutes / 60).toLocaleString()}h goal
            </span>
          </p>
          <p className="text-[13px] text-[var(--ui-secondary)]">{loading ? "" : stats.join("  ·  ")}</p>
        </div>
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--ui-fill-strong)]"
          role="progressbar"
          aria-label="Daily focus goal"
          aria-valuenow={Math.round(focusProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[var(--dx-accent)] transition-all duration-700 ease-out"
            style={{ width: `${focusProgress}%` }}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ui-card overflow-hidden !p-0">
          <CardHeader title="Due today" action="Tasks" onAction={() => onNavigate("tasks")} />
          {tasks === null ? (
            <Empty>Loading…</Empty>
          ) : dueTasks.length === 0 ? (
            <Empty>Nothing due. Enjoy the clear day.</Empty>
          ) : (
            <ul className="px-2 pb-2">
              {dueTasks.slice(0, 6).map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate("tasks")}
                    className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-[var(--ui-fill)]"
                  >
                    <span className="h-[16px] w-[16px] shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--ui-tertiary)]" />
                    <span className="min-w-0 flex-1 truncate text-[14px]">{task.title}</span>
                    {task.due_date && task.due_date < todayKey ? (
                      <span className="shrink-0 text-[12px] text-[var(--dx-danger)]">Overdue</span>
                    ) : task.job_name ? (
                      <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-[var(--ui-secondary)]">
                        <JobMark color={task.job_color} emoji={task.job_emoji} size="xs" />
                        {task.job_name}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
              {dueTasks.length > 6 && (
                <li className="px-3 py-1.5 text-[12px] text-[var(--ui-secondary)]">+{dueTasks.length - 6} more</li>
              )}
            </ul>
          )}
        </section>

        <section className="ui-card overflow-hidden !p-0">
          <CardHeader title="Top apps" action="Timeline" onAction={() => onNavigate("activity")} />
          {usage.length === 0 ? (
            <Empty>{loading ? "Loading…" : "No activity tracked yet today."}</Empty>
          ) : (
            <ul className="space-y-3.5 px-5 pb-5 pt-2">
              {usage.slice(0, 5).map(([app, seconds]) => (
                <li key={app}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[14px]" title={app}>
                      {app}
                    </span>
                    <span className="shrink-0 text-[13px] tabular-nums text-[var(--ui-secondary)]">
                      {formatDuration(seconds)}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-[var(--ui-fill-strong)]">
                    <div
                      className="h-full rounded-full bg-[var(--dx-accent)]"
                      style={{ width: `${maxUsage > 0 ? (seconds / maxUsage) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function getPageFromUrl(): Page {
  const params = new URLSearchParams(window.location.search);
  const requestedPage = params.get("page");

  const validPages: Page[] = [
    "overview",
    "tasks",
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

  const pageTitle = PAGE_TITLES[activePage];
  const fitsWindow = activePage === "calendar" || activePage === "tasks";

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
      case "tasks":
        return <Tasks />;
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
            {/* Overview draws its own greeting header. */}
            {activePage !== "overview" && (
              <h1
                className={[
                  "shrink-0 text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[34px]",
                  fitsWindow ? "mb-5" : "mb-7",
                ].join(" ")}
              >
                {pageTitle}
              </h1>
            )}

            <div className={fitsWindow ? "lg:min-h-0 lg:flex-1" : ""}>
              {renderPage()}
            </div>
          </div>
        </main>
    </div>
  );
}
