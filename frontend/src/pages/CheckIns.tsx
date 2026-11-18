import { useEffect, useState, type FormEvent } from "react";
import DateNav from "../components/DateNav";
import { todayIso } from "../lib/dates";
import { createCheckIn, getDailyCheckIns, type DeveloperCheckIn } from "../services/api";
import "./calendar.css";

const CATEGORIES = ["Coding", "Debugging", "Testing", "Research", "Other"];

function timeLabel(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return createdAt.slice(11, 16);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(d);
}

export default function CheckIns() {
  const [projectName, setProjectName] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [category, setCategory] = useState("Coding");
  const [blocker, setBlocker] = useState("");
  const [showBlocker, setShowBlocker] = useState(false);

  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [checkins, setCheckins] = useState<DeveloperCheckIn[]>([]);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await getDailyCheckIns(selectedDate);
        if (cancelled) return;
        setCheckins(result.checkins);
        setRecentProjects((current) =>
          Array.from(new Set([...result.checkins.map((c) => c.project_name), ...current])).slice(0, 12)
        );
      } catch {
        if (!cancelled) {
          setCheckins([]);
          setError("Unable to load check-ins.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, refreshKey]);

  const canSave = projectName.trim() !== "" && workDescription.trim() !== "" && !saving;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError("");
    try {
      await createCheckIn({
        project_name: projectName.trim(),
        work_description: workDescription.trim(),
        category,
        blocker: blocker.trim() || null,
      });
      setWorkDescription("");
      setBlocker("");
      setShowBlocker(false);
      // Keep the project name: consecutive check-ins are usually for the same project.
      if (selectedDate !== todayIso()) setSelectedDate(todayIso());
      else setRefreshKey((k) => k + 1);
    } catch {
      setError("Couldn’t save the check-in. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const isToday = selectedDate === todayIso();

  return (
    <div className="cal mx-auto max-w-[720px] space-y-8">
      {/* Composer */}
      <form onSubmit={handleSubmit} className="ui-card space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            maxLength={150}
            required
            list="checkin-projects"
            placeholder="Project"
            aria-label="Project name"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[var(--dx-heading)] outline-none placeholder:text-[var(--ui-tertiary)]"
          />
          <datalist id="checkin-projects">
            {recentProjects.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>

        <textarea
          value={workDescription}
          onChange={(e) => setWorkDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
          required
          rows={3}
          placeholder="What did you work on?"
          aria-label="What did you work on?"
          className="block w-full resize-none bg-transparent text-[14px] leading-relaxed text-[var(--dx-heading)] outline-none placeholder:text-[var(--ui-tertiary)]"
        />

        {showBlocker && (
          <textarea
            value={blocker}
            onChange={(e) => setBlocker(e.target.value)}
            rows={2}
            autoFocus
            placeholder="What’s blocking you?"
            aria-label="Blocker"
            className="block w-full resize-none rounded-[10px] bg-[var(--ui-fill)] px-3 py-2 text-[13px] text-[var(--dx-heading)] outline-none placeholder:text-[var(--ui-tertiary)]"
          />
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--ui-hairline)] pt-3">
          <div className="cal-segmented !w-auto" role="group" aria-label="Category">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>

          {!showBlocker && (
            <button type="button" onClick={() => setShowBlocker(true)} className="cal-link-btn">
              Add blocker
            </button>
          )}

          <button type="submit" disabled={!canSave} className="ui-btn-primary ml-auto h-8 px-4 text-[13px]">
            {saving ? "Saving…" : "Check in"}
          </button>
        </div>
      </form>

      {/* Day */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <DateNav value={selectedDate} onChange={setSelectedDate} />
          {!loading && checkins.length > 0 && (
            <span className="text-[13px] text-[var(--ui-secondary)]">
              {checkins.length} {checkins.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>

        {error && (
          <p role="alert" className="mb-3 px-1 text-[13px] text-[var(--dx-danger)]">
            {error}
          </p>
        )}

        {loading ? (
          <p className="px-1 text-[13px] text-[var(--ui-tertiary)]">Loading…</p>
        ) : checkins.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-[15px] font-medium">No check-ins</p>
            <p className="mt-1 text-[13px] text-[var(--ui-secondary)]">
              {isToday ? "Write a quick note above to log what you’re doing." : "Nothing was logged on this day."}
            </p>
          </div>
        ) : (
          <ol className="ui-card divide-y divide-[var(--ui-hairline)] !p-0">
            {checkins.map((c) => (
              <li key={c.id} className="flex gap-4 px-4 py-3.5 sm:px-5">
                <time className="w-[64px] shrink-0 pt-px text-[12px] tabular-nums text-[var(--ui-tertiary)]">
                  {timeLabel(c.created_at)}
                </time>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
                    <span className="font-semibold text-[var(--dx-heading)]">{c.project_name}</span>
                    <span className="text-[12px] text-[var(--ui-secondary)]">{c.category}</span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--dx-body)]">
                    {c.work_description}
                  </p>
                  {c.blocker && (
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-[var(--dx-warning)]">
                      Blocked: {c.blocker}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
