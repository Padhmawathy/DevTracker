
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
    <div className="grid items-start gap-5 xl:grid-cols-2">

      <form
        onSubmit={handleSubmit}
        className="ui-card space-y-5 p-6"
      >
        <h2 className="text-[17px] font-semibold tracking-[-0.02em]">
          New Check-in
        </h2>

        <div>
          <label
            htmlFor="project"
            className="mb-2 block text-sm text-[var(--dx-body)]"
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
            className="ui-input"
          />
        </div>

        <div>
          <label
            htmlFor="work"
            className="mb-2 block text-sm text-[var(--dx-body)]"
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
            className="ui-input"
          />
        </div>

        <div>
          <label
            htmlFor="category"
            className="mb-2 block text-sm text-[var(--dx-body)]"
          >
            Category
          </label>

          <select
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="ui-input"
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
            className="mb-2 block text-sm text-[var(--dx-body)]"
          >
            Blockers (optional)
          </label>

          <textarea
            id="blocker"
            value={blocker}
            onChange={(event) => setBlocker(event.target.value)}
            rows={2}
            placeholder="Any issues slowing you down?"
            className="ui-input"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="ui-btn-primary px-5 py-2.5"
        >
          {saving ? "Saving..." : "Save Check-in"}
        </button>

        {success && (
          <p role="status" className="text-sm text-[var(--dx-accent-text)]">
            {success}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-[var(--dx-danger)]">
            {error}
          </p>
        )}
      </form>

      <section className="ui-card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em]">
            Saved Check-ins
          </h2>

          <input
            type="date"
            aria-label="Check-in date"
            value={selectedDate}
            onChange={(event) =>
              setSelectedDate(event.target.value)
            }
            className="ui-input w-auto"
          />
        </div>

        {loading ? (
          <p className="text-[var(--dx-muted)]">
            Loading check-ins...
          </p>
        ) : checkins.length === 0 ? (
          <div className="ui-card p-6 text-[var(--dx-muted)]">
            No check-ins found for this date.
          </div>
        ) : (
          <div className="space-y-4">
            {checkins.map((checkin) => (
              <article
                key={checkin.id}
                className="rounded-[12px] bg-[var(--ui-fill)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">
                    {checkin.project_name}
                  </h3>

                  <span className="rounded-full bg-[var(--dx-accent-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--dx-accent-text)]">
                    {checkin.category}
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--dx-body)]">
                  {checkin.work_description}
                </p>

                {checkin.blocker && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--dx-warning)]">
                    Blocker: {checkin.blocker}
                  </p>
                )}

                <p className="mt-4 text-xs text-[var(--dx-muted)]">
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
