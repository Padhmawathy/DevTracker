
import { useEffect, useState, type FormEvent } from "react";
import {
  createCheckIn,
  getDailyCheckIns,
  type DeveloperCheckIn,
} from "../services/api";

function getLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function CheckIns() {
  const [projectName, setProjectName] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [category, setCategory] = useState("Coding");
  const [blocker, setBlocker] = useState("");

  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [checkins, setCheckins] = useState<DeveloperCheckIn[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCheckIns() {
      setLoading(true);
      setError("");
      setCheckins([]);

      try {
        const result = await getDailyCheckIns(selectedDate);

        if (!cancelled) {
          setCheckins(result.checkins);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load check-ins.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCheckIns();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, refreshKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!projectName.trim() || !workDescription.trim()) {
      setError("Project name and work description are required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createCheckIn({
        project_name: projectName.trim(),
        work_description: workDescription.trim(),
        category,
        blocker: blocker.trim() || null,
      });

      setProjectName("");
      setWorkDescription("");
      setBlocker("");

      setSuccess("Check-in saved successfully!");

      const today = getLocalDate();

      if (selectedDate !== today) {
        setSelectedDate(today);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch {
      setError("Failed to save check-in. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-indigo-400">
          Developer Workspace
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Developer Check-ins
        </h1>

        <p className="mt-2 text-slate-400">
          Record your work, track progress, and document blockers.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6"
      >
        <h2 className="text-lg font-semibold">
          New Check-in
        </h2>

        <div>
          <label
            htmlFor="project"
            className="mb-2 block text-sm text-slate-300"
          >
            Project name
          </label>

          <input
            id="project"
            type="text"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            required
            maxLength={150}
            placeholder="e.g. DevTracker"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor="work"
            className="mb-2 block text-sm text-slate-300"
          >
            What are you working on?
          </label>

          <textarea
            id="work"
            value={workDescription}
            onChange={(event) =>
              setWorkDescription(event.target.value)
            }
            required
            rows={4}
            placeholder="Describe your work..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor="category"
            className="mb-2 block text-sm text-slate-300"
          >
            Category
          </label>

          <select
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="Coding">Coding</option>
            <option value="Debugging">Debugging</option>
            <option value="Testing">Testing</option>
            <option value="Research">Research</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="blocker"
            className="mb-2 block text-sm text-slate-300"
          >
            Blockers (optional)
          </label>

          <textarea
            id="blocker"
            value={blocker}
            onChange={(event) => setBlocker(event.target.value)}
            rows={2}
            placeholder="Any issues slowing you down?"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Check-in"}
        </button>

        {success && (
          <p role="status" className="text-sm text-green-400">
            {success}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
      </form>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">
            Saved Check-ins
          </h2>

          <input
            type="date"
            aria-label="Check-in date"
            value={selectedDate}
            onChange={(event) =>
              setSelectedDate(event.target.value)
            }
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white"
          />
        </div>

        {loading ? (
          <p className="text-slate-400">
            Loading check-ins...
          </p>
        ) : checkins.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
            No check-ins found for this date.
          </div>
        ) : (
          <div className="space-y-4">
            {checkins.map((checkin) => (
              <article
                key={checkin.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">
                    {checkin.project_name}
                  </h3>

                  <span className="rounded-md bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">
                    {checkin.category}
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">
                  {checkin.work_description}
                </p>

                {checkin.blocker && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-amber-400">
                    Blocker: {checkin.blocker}
                  </p>
                )}

                <p className="mt-4 text-xs text-slate-500">
                  {checkin.created_at
                    .replace("T", " ")
                    .slice(0, 19)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
