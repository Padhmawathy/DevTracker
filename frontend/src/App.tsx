
import { useEffect, useState } from "react";
import Sidebar, { type Page } from "./components/Sidebar";
import ActivityTimeline from "./pages/ActivityTimeline";
import CheckIns from "./pages/CheckIns";
import Reports from "./pages/Reports";

import {
  getTodaySummary,
  type DailySummary,
} from "./services/api";

function formatDuration(seconds: number): string {
  const totalSeconds = Math.floor(seconds);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function App() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<Page>("overview");

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      try {
        const data = await getTodaySummary();

        if (active) {
          setSummary(data);
        }
      } catch {
        if (active) {
          setError("Could not connect to DevTracker API.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      active = false;
    };
  }, []);

  const stats = [
    {
      label: "Tracked Time",
      value: summary
        ? formatDuration(summary.total_tracked_seconds)
        : "—",
    },
    {
      label: "Check-ins",
      value: summary
        ? String(summary.checkin_count)
        : "—",
    },
    {
      label: "Projects",
      value: summary
        ? String(Object.keys(summary.projects).length)
        : "—",
    },
  ];

  const applications = summary
    ? Object.entries(summary.application_usage).sort(
        (a, b) => b[1] - a[1]
      )
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-white md:flex">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <main className="min-w-0 flex-1 p-6 md:p-10">
        {activePage === "activity" ? (
          <ActivityTimeline />
        ) : activePage === "checkins" ? (
          <CheckIns />
        ) : activePage === "reports" ? (
          <Reports />
        ) : (
          <>
            <header className="mb-10">
              <p className="text-sm text-indigo-400">
                Developer Workspace
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                Dashboard Overview
              </h1>

              <p className="mt-2 text-slate-400">
                Your development activity for today.
              </p>
            </header>

            {loading && (
              <p className="text-slate-400">
                Loading your activity...
              </p>
            )}

            {error && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-red-800 bg-red-950 p-4 text-red-300"
              >
                {error}
              </div>
            )}

            <section className="grid gap-5 md:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-6"
                >
                  <p className="text-sm text-slate-400">
                    {stat.label}
                  </p>

                  <h2 className="mt-3 text-3xl font-bold">
                    {stat.value}
                  </h2>
                </div>
              ))}
            </section>

            <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-lg font-semibold">
                Application Usage
              </h2>

              {applications.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">
                  {loading
                    ? "Loading..."
                    : "No application activity recorded for today."}
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {applications.map(([app, seconds]) => (
                    <div
                      key={app}
                      className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3"
                    >
                      <span className="text-sm text-slate-300">
                        {app}
                      </span>

                      <span className="text-sm font-medium text-indigo-400">
                        {formatDuration(seconds)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
