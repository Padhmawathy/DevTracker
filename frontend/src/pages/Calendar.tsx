import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  PLATFORM_LABELS,
  createJob,
  createWorkEntry,
  deleteWorkEntry,
  getJobs,
  getWorkEntries,
  updateJob,
  updateWorkEntry,
  type Job,
  type Platform,
  type WorkEntry,
  type WorkEntryPayload,
  type WorkEntryStatus,
} from "../services/api";
import JobMark from "../components/JobMark";
import "./calendar.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLATFORMS = Object.keys(PLATFORM_LABELS) as Platform[];
// Apple system palette (blue, green, orange, purple, pink, teal, yellow, graphite)
const JOB_COLORS = [
  "#0a84ff", "#30d158", "#ff9f0a", "#bf5af2",
  "#ff375f", "#40c8e0", "#ffd60a", "#8e8e93",
];
const JOB_EMOJIS = [
  "🐱", "🐶", "🐰", "🦊", "🐼", "🐨", "🐸", "🐥", "🦄", "🐝", "🦋", "🐙",
  "🌸", "🌷", "🌻", "🍀", "🌈", "⭐", "✨", "🌙", "🍓", "🍑", "🍩", "🧁",
  "☕", "🎀", "💖", "💜", "🎨", "📸", "✏️", "📚", "💼", "🚀", "🎧", "🎮",
];

function EmojiGrid({ value, onPick }: { value: string | null; onPick: (emoji: string) => void }) {
  return (
    <div className="grid grid-cols-9 gap-0.5" role="group" aria-label="Emoji">
      {JOB_EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          aria-label={`Emoji ${e}`}
          aria-pressed={value === e}
          className={`flex aspect-square items-center justify-center rounded-[8px] text-[18px] leading-none transition-transform hover:scale-110 ${
            value === e ? "bg-[var(--dx-accent-soft)] shadow-[inset_0_0_0_1.5px_var(--dx-accent)]" : "hover:bg-[var(--ui-fill)]"
          }`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHours(hours: number): string {
  return `${Number(hours.toFixed(2))}h`;
}

/** 6x7 grid of dates starting on the Monday on/before the 1st. */
function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from(
    { length: 42 },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
  );
}

type EntryForm = {
  job_id: string;
  description: string;
  platform: "" | Platform;
  link: string;
  hours: string;
  status: WorkEntryStatus;
};

const emptyEntryForm = (jobId = ""): EntryForm => ({
  job_id: jobId,
  description: "",
  platform: "",
  link: "",
  hours: "",
  status: "done",
});

const chip =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors";
const chipOn = "bg-[var(--ui-fill-strong)] font-medium text-[var(--dx-heading)]";
const chipOff = "text-[var(--ui-secondary)] hover:bg-[var(--ui-fill)] hover:text-[var(--dx-heading)]";

export default function Calendar() {
  const today = toIso(new Date());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(today);
  const [jobFilter, setJobFilter] = useState<number | "all">("all");
  const [panel, setPanel] = useState<"day" | "jobs">("day");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [form, setForm] = useState<EntryForm>(emptyEntryForm());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [jobName, setJobName] = useState("");
  const [jobClient, setJobClient] = useState("");
  const [jobColor, setJobColor] = useState(JOB_COLORS[0]);
  const [jobMarkMode, setJobMarkMode] = useState<"color" | "emoji">("emoji");
  const [jobEmoji, setJobEmoji] = useState<string>(JOB_EMOJIS[0]);
  const [markPickerFor, setMarkPickerFor] = useState<number | null>(null);

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const rangeStart = toIso(grid[0]);
  const rangeEnd = toIso(grid[grid.length - 1]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [jobList, entryList] = await Promise.all([
          getJobs(),
          getWorkEntries(rangeStart, rangeEnd),
        ]);
        if (cancelled) return;
        setJobs(jobList);
        setEntries(entryList);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Unable to load calendar.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, refreshKey]);

  const activeJobs = useMemo(() => jobs.filter((job) => job.status === "active"), [jobs]);

  // When no job is picked yet, default to the filtered job or the first active one.
  const formJobId =
    form.job_id ||
    (jobFilter !== "all" ? String(jobFilter) : activeJobs[0] ? String(activeJobs[0].id) : "");

  const visibleEntries = useMemo(
    () => (jobFilter === "all" ? entries : entries.filter((e) => e.job_id === jobFilter)),
    [entries, jobFilter]
  );

  const entriesByDay = useMemo(() => {
    const map = new Map<string, WorkEntry[]>();
    for (const entry of visibleEntries) {
      const list = map.get(entry.entry_date) ?? [];
      list.push(entry);
      map.set(entry.entry_date, list);
    }
    return map;
  }, [visibleEntries]);

  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;

  const monthTotals = useMemo(() => {
    let done = 0;
    let planned = 0;
    let posts = 0;
    for (const e of visibleEntries) {
      if (!e.entry_date.startsWith(monthPrefix)) continue;
      if (e.hours) {
        if (e.status === "done") done += e.hours;
        else planned += e.hours;
      }
      if (e.platform) posts += 1;
    }
    return { done, planned, posts };
  }, [visibleEntries, monthPrefix]);

  const dayEntries = entriesByDay.get(selectedDay) ?? [];

  function shiftMonth(delta: number) {
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToday() {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    selectDay(today);
  }

  function selectDay(iso: string) {
    setSelectedDay(iso);
    setPanel("day");
    if (editingId !== null) closeForm();
  }

  function closeForm() {
    setEditingId(null);
    setShowForm(false);
    setForm(emptyEntryForm());
  }

  function openNewEntry() {
    setEditingId(null);
    setForm(emptyEntryForm());
    setShowForm(true);
  }

  function startEdit(entry: WorkEntry) {
    setEditingId(entry.id);
    setShowForm(true);
    setForm({
      job_id: String(entry.job_id),
      description: entry.description,
      platform: entry.platform ?? "",
      link: entry.link ?? "",
      hours: entry.hours == null ? "" : String(entry.hours),
      status: entry.status,
    });
  }

  async function handleEntrySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const hours = form.hours.trim() === "" ? null : Number(form.hours);
    if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 24)) {
      setError("Hours must be between 0 and 24.");
      return;
    }
    if (!formJobId) {
      setError("Add a job first.");
      return;
    }

    const payload: WorkEntryPayload = {
      job_id: Number(formJobId),
      entry_date: selectedDay,
      description: form.description.trim(),
      platform: form.platform || null,
      link: form.platform ? form.link.trim() || null : null,
      hours,
      status: form.status,
    };

    setSaving(true);
    try {
      if (editingId === null) await createWorkEntry(payload);
      else await updateWorkEntry(editingId, payload);
      closeForm();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: WorkEntry) {
    setError("");
    try {
      await deleteWorkEntry(entry.id);
      if (editingId === entry.id) closeForm();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleJobSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await createJob({
        name: jobName.trim(),
        client: jobClient.trim() || null,
        color: jobColor,
        emoji: jobMarkMode === "emoji" ? jobEmoji : null,
        status: "active",
      });
      setJobName("");
      setJobClient("");
      setJobColor(JOB_COLORS[(jobs.length + 1) % JOB_COLORS.length]);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleArchive(job: Job) {
    setError("");
    try {
      await updateJob(job.id, {
        name: job.name,
        client: job.client,
        color: job.color,
        emoji: job.emoji,
        status: job.status === "active" ? "archived" : "active",
      });
      if (jobFilter === job.id) setJobFilter("all");
      if (form.job_id === String(job.id) && editingId === null) {
        setForm((f) => ({ ...f, job_id: "" }));
      }
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function changeJobMark(job: Job, mark: { emoji: string | null; color?: string }) {
    setError("");
    try {
      await updateJob(job.id, {
        name: job.name,
        client: job.client,
        color: mark.color ?? job.color,
        emoji: mark.emoji,
        status: job.status,
      });
      setMarkPickerFor(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // Jobs selectable in the form: active ones, plus the entry's own job when editing.
  const formJobs = jobs.filter((job) => job.status === "active" || String(job.id) === formJobId);

  const monthName = new Intl.DateTimeFormat("en-IN", { month: "long" }).format(
    new Date(cursor.year, cursor.month, 1)
  );
  const selectedDate = new Date(`${selectedDay}T00:00:00`);
  const selectedLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(selectedDate);
  const dayHours = dayEntries.reduce((sum, e) => sum + (e.hours ?? 0), 0);

  const monthLine = [
    monthTotals.done ? `${formatHours(monthTotals.done)} logged` : null,
    monthTotals.planned ? `${formatHours(monthTotals.planned)} planned` : null,
    monthTotals.posts ? `${monthTotals.posts} ${monthTotals.posts === 1 ? "post" : "posts"}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="cal flex flex-col gap-4 lg:h-full">
      {error && (
        <div role="alert" className="flex shrink-0 items-center gap-3 px-1 text-[13px] text-[var(--dx-danger)]">
          <span className="flex-1">{error}</span>
          <button type="button" className="cal-link-btn" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------- Month ---------------- */}
        <section className="flex flex-col lg:min-h-0">
          <header className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-3 px-1">
            <div aria-live="polite">
              <h2 className="cal-title">
                {monthName} <span className="font-normal text-[var(--cal-tertiary)]">{cursor.year}</span>
              </h2>
              <p className="mt-0.5 h-[18px] text-[13px] text-[var(--cal-secondary)]">
                {loading ? "Updating…" : monthLine || "Nothing logged yet"}
              </p>
            </div>

            <div className="flex items-center">
              <button type="button" className="cal-icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <Chevron dir="left" />
              </button>
              <button type="button" className="cal-pill" onClick={goToday}>Today</button>
              <button type="button" className="cal-icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
                <Chevron dir="right" />
              </button>
            </div>
          </header>

          {/* Job filter */}
          <div className="mb-3 flex shrink-0 gap-1 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Filter by job">
            <button
              type="button"
              aria-pressed={jobFilter === "all"}
              onClick={() => setJobFilter("all")}
              className={`${chip} ${jobFilter === "all" ? chipOn : chipOff}`}
            >
              All jobs
            </button>
            {activeJobs.map((job) => (
              <button
                key={job.id}
                type="button"
                aria-pressed={jobFilter === job.id}
                onClick={() => setJobFilter(jobFilter === job.id ? "all" : job.id)}
                className={`${chip} ${jobFilter === job.id ? chipOn : chipOff}`}
              >
                <JobMark color={job.color} emoji={job.emoji} size="sm" />
                {job.name}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={panel === "jobs"}
              onClick={() => setPanel(panel === "jobs" ? "day" : "jobs")}
              className={`${chip} ${panel === "jobs" ? chipOn : chipOff}`}
            >
              {jobs.length === 0 ? "+ Add a job" : "Manage"}
            </button>
          </div>

          <div className="cal-card cal-grid-fit grid grid-cols-7 overflow-hidden px-2 pb-2 pt-1 lg:min-h-0 lg:flex-1 lg:grid-rows-[auto_repeat(6,minmax(0,1fr))]">
            {WEEKDAYS.map((d) => (
              <div key={d} className="cal-weekday">{d}</div>
            ))}

            {grid.map((d, index) => {
              const iso = toIso(d);
              const inMonth = d.getMonth() === cursor.month;
              const items = entriesByDay.get(iso) ?? [];
              const weekend = index % 7 >= 5;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    selectDay(iso);
                    if (!inMonth) setCursor({ year: d.getFullYear(), month: d.getMonth() });
                  }}
                  aria-pressed={iso === selectedDay}
                  aria-label={`${iso}, ${items.length} ${items.length === 1 ? "entry" : "entries"}`}
                  className={[
                    "cal-day",
                    inMonth ? "" : "is-outside",
                    weekend ? "is-weekend" : "",
                    iso === selectedDay ? "is-selected" : "",
                    iso === today ? "is-today" : "",
                  ].join(" ")}
                >
                  <span className="cal-daynum">{d.getDate()}</span>

                  {/* Dots on phones, titled events on wider screens */}
                  <span className="flex flex-wrap gap-[3px] px-1 sm:hidden">
                    {items.slice(0, 4).map((e) => (
                      <JobMark key={e.id} color={e.job_color} emoji={e.job_emoji} size="xs" dim={e.status === "planned"} />
                    ))}
                  </span>
                  <span className="hidden min-w-0 flex-col gap-[3px] sm:flex">
                    {items.slice(0, 2).map((e) => (
                      <span
                        key={e.id}
                        className={`cal-event ${e.status === "planned" ? "is-planned" : ""}`}
                        title={`${e.job_name}: ${e.description}`}
                      >
                        {e.job_emoji ? (
                          <JobMark emoji={e.job_emoji} size="xs" />
                        ) : (
                          <span className="cal-event-dot" style={{ backgroundColor: e.job_color, color: e.job_color }} />
                        )}
                        <span className="truncate">{e.platform ? PLATFORM_LABELS[e.platform] : e.job_name}</span>
                      </span>
                    ))}
                    {items.length > 2 && (
                      <span className="pl-[11px] text-[11px] text-[var(--cal-tertiary)]">{items.length - 2} more</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ---------------- Side panel ---------------- */}
        <aside className="cal-card flex flex-col p-5 lg:min-h-0">
          {panel === "jobs" ? (
            <>
              <header className="flex shrink-0 items-center justify-between">
                <h2 className="text-[20px] font-bold tracking-[-0.025em]">Jobs</h2>
                <button type="button" className="cal-link-btn" onClick={() => setPanel("day")}>Done</button>
              </header>

              <div className="cal-scroll -mr-2 mt-4 min-h-0 flex-1 space-y-5 pr-2">
                {jobs.length > 0 && (
                  <ul className="cal-group">
                    {jobs.map((job) => (
                      <li key={job.id} className="cal-row flex-wrap py-2.5">
                        <button
                          type="button"
                          onClick={() => setMarkPickerFor(markPickerFor === job.id ? null : job.id)}
                          aria-label={`Change icon for ${job.name}`}
                          aria-expanded={markPickerFor === job.id}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-[var(--ui-fill)]"
                        >
                          <JobMark color={job.color} emoji={job.emoji} size="md" dim={job.status === "archived"} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-[14px] ${job.status === "archived" ? "text-[var(--cal-tertiary)]" : ""}`}>{job.name}</p>
                          <p className="truncate text-[12px] text-[var(--cal-secondary)]">
                            {[
                              job.client,
                              formatHours(job.done_hours),
                              `${job.post_count} ${job.post_count === 1 ? "post" : "posts"}`,
                            ].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <button type="button" className="cal-link-btn" onClick={() => void toggleArchive(job)}>
                          {job.status === "active" ? "Archive" : "Restore"}
                        </button>
                        {markPickerFor === job.id && (
                          <div className="basis-full space-y-2 pb-1 pt-2">
                            <EmojiGrid value={job.emoji} onPick={(emoji) => void changeJobMark(job, { emoji })} />
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <span className="text-[12px] text-[var(--cal-secondary)]">Or a color</span>
                              {JOB_COLORS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => void changeJobMark(job, { emoji: null, color: c })}
                                  aria-label={`Color ${c}`}
                                  aria-pressed={!job.emoji && job.color === c}
                                  className="h-[18px] w-[18px] rounded-full transition-transform hover:scale-110"
                                  style={{
                                    backgroundColor: c,
                                    boxShadow: !job.emoji && job.color === c ? `0 0 0 2px var(--dx-surface), 0 0 0 4px ${c}` : undefined,
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <form onSubmit={handleJobSubmit} className="space-y-3">
                  <p className="cal-eyebrow">New job</p>
                  <div className="cal-group">
                    <label className="cal-row">
                      <span className="cal-row-label">Name</span>
                      <input required maxLength={100} value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="Acme social media" className="cal-field" />
                    </label>
                    <label className="cal-row">
                      <span className="cal-row-label">Client</span>
                      <input maxLength={100} value={jobClient} onChange={(e) => setJobClient(e.target.value)} placeholder="Optional" className="cal-field" />
                    </label>
                  </div>
                  <div className="cal-segmented" role="group" aria-label="Job icon">
                    <button type="button" aria-pressed={jobMarkMode === "emoji"} onClick={() => setJobMarkMode("emoji")}>Emoji</button>
                    <button type="button" aria-pressed={jobMarkMode === "color"} onClick={() => setJobMarkMode("color")}>Color</button>
                  </div>
                  {jobMarkMode === "emoji" ? (
                    <EmojiGrid value={jobEmoji} onPick={setJobEmoji} />
                  ) : (
                    <div className="flex flex-wrap gap-2.5 py-1" role="group" aria-label="Color">
                      {JOB_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setJobColor(c)}
                          aria-label={`Color ${c}`}
                          aria-pressed={jobColor === c}
                          className="h-[22px] w-[22px] rounded-full transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c,
                            boxShadow: jobColor === c ? `0 0 0 2px var(--dx-surface), 0 0 0 4px ${c}` : undefined,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--cal-secondary)]">
                      <JobMark color={jobColor} emoji={jobMarkMode === "emoji" ? jobEmoji : null} size="md" />
                      <span className="truncate">{jobName.trim() || "Preview"}</span>
                    </span>
                    <button type="submit" disabled={!jobName.trim()} className="cal-pill cal-pill-primary">Add</button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <>
              <header className="flex shrink-0 items-start justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-bold tracking-[-0.025em]">
                    {selectedDay === today ? "Today" : selectedLabel.split(",")[0]}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-[var(--cal-secondary)]">
                    {selectedDay === today ? selectedLabel : selectedLabel.split(", ").slice(1).join(", ")}
                    {dayHours ? ` · ${formatHours(dayHours)}` : ""}
                  </p>
                </div>
                {!showForm && jobs.length > 0 && (
                  <button type="button" className="cal-pill cal-pill-primary shrink-0" onClick={openNewEntry}>
                    Add entry
                  </button>
                )}
              </header>

              <div className="cal-scroll -mr-2 mt-4 min-h-0 flex-1 pr-2">
                {dayEntries.length === 0 && !showForm ? (
                  <div className="flex h-full min-h-[120px] flex-col items-center justify-center text-center">
                    <p className="text-[14px] text-[var(--cal-tertiary)]">
                      {jobs.length === 0 ? "Add a job to start logging work." : "Nothing logged."}
                    </p>
                    {jobs.length === 0 && (
                      <button type="button" className="cal-link-btn mt-2" onClick={() => setPanel("jobs")}>Add a job</button>
                    )}
                  </div>
                ) : (
                  <ul className="space-y-1" aria-label="Entries for this day">
                    {dayEntries.map((e) => (
                      <li key={e.id} className={`group rounded-[10px] px-3 py-2.5 ${editingId === e.id ? "bg-[var(--dx-accent-soft)]" : "hover:bg-[var(--ui-fill)]"}`}>
                        <div className="flex gap-3">
                          <span className="mt-1 w-[3px] shrink-0 self-stretch rounded-full" style={{ backgroundColor: e.job_color, opacity: e.status === "planned" ? 0.4 : 1 }} />
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">{e.description}</p>
                            <p className="mt-1 text-[12px] text-[var(--cal-secondary)]">
                              {[
                                e.job_emoji ? `${e.job_emoji} ${e.job_name}` : e.job_name,
                                e.platform ? PLATFORM_LABELS[e.platform] : null,
                                e.hours != null ? formatHours(e.hours) : null,
                                e.status === "planned" ? "Planned" : null,
                              ].filter(Boolean).join(" · ")}
                            </p>
                            {e.link && (
                              <a href={e.link} target="_blank" rel="noreferrer noopener" className="mt-1 block truncate text-[12px] text-[var(--dx-accent-text)] hover:underline">
                                {e.link.replace(/^https?:\/\//, "")}
                              </a>
                            )}
                            <div className="mt-1.5 flex gap-4 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                              <button type="button" className="cal-link-btn" onClick={() => startEdit(e)}>Edit</button>
                              <button type="button" className="cal-link-btn is-danger" onClick={() => void handleDelete(e)}>Delete</button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {showForm && (
                <form onSubmit={handleEntrySubmit} className="mt-4 shrink-0 space-y-3 border-t border-[var(--ui-hairline)] pt-4">
                  <div className="cal-group">
                    <label className="cal-row !items-start">
                      <span className="sr-only">Description</span>
                      <textarea
                        rows={2}
                        required
                        autoFocus
                        maxLength={2000}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder={form.platform ? "What did you post?" : "What did you work on?"}
                        className="cal-field"
                      />
                    </label>
                    <label className="cal-row">
                      <span className="cal-row-label">Job</span>
                      <select value={formJobId} onChange={(e) => setForm({ ...form, job_id: e.target.value })} required className="cal-field">
                        <option value="" disabled>Select…</option>
                        {formJobs.map((job) => (
                          <option key={job.id} value={job.id}>{job.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="cal-row">
                      <span className="cal-row-label">Type</span>
                      <select
                        value={form.platform}
                        onChange={(e) => setForm({ ...form, platform: e.target.value as EntryForm["platform"] })}
                        className="cal-field"
                      >
                        <option value="">Work</option>
                        {PLATFORMS.map((p) => (
                          <option key={p} value={p}>{PLATFORM_LABELS[p]} post</option>
                        ))}
                      </select>
                    </label>
                    {form.platform && (
                      <label className="cal-row">
                        <span className="cal-row-label">Link</span>
                        <input type="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" className="cal-field" />
                      </label>
                    )}
                    <label className="cal-row">
                      <span className="cal-row-label">Hours</span>
                      <input
                        type="number"
                        min="0.25"
                        max="24"
                        step="0.25"
                        value={form.hours}
                        onChange={(e) => setForm({ ...form, hours: e.target.value })}
                        placeholder="Optional"
                        className="cal-field"
                      />
                    </label>
                    <label className="cal-row">
                      <span className="cal-row-label">Planned</span>
                      <span className="flex flex-1 justify-end py-2">
                        <input
                          type="checkbox"
                          checked={form.status === "planned"}
                          onChange={(e) => setForm({ ...form, status: e.target.checked ? "planned" : "done" })}
                          className="ui-switch"
                        />
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button type="button" className="cal-pill" onClick={closeForm}>Cancel</button>
                    <button type="submit" disabled={saving} className="cal-pill cal-pill-primary">
                      {saving ? "Saving…" : editingId === null ? "Add" : "Save"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}
