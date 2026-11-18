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
import "./calendar.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLATFORMS = Object.keys(PLATFORM_LABELS) as Platform[];
// Apple system palette (blue, green, orange, purple, pink, teal, yellow, graphite)
const JOB_COLORS = [
  "#0a84ff", "#30d158", "#ff9f0a", "#bf5af2",
  "#ff375f", "#40c8e0", "#ffd60a", "#8e8e93",
];

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
    (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
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

export default function Calendar() {
  const today = toIso(new Date());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(today);
  const [jobFilter, setJobFilter] = useState<number | "all">("all");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [form, setForm] = useState<EntryForm>(emptyEntryForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [showJobForm, setShowJobForm] = useState(false);
  const [jobName, setJobName] = useState("");
  const [jobClient, setJobClient] = useState("");
  const [jobColor, setJobColor] = useState(JOB_COLORS[0]);

  const grid = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor]
  );
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
        if (!cancelled) {
          setError((err as Error).message || "Unable to load calendar.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, refreshKey]);

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === "active"),
    [jobs]
  );

  // When no job is picked yet, default to the first active job.
  const formJobId =
    form.job_id || (activeJobs[0] ? String(activeJobs[0].id) : "");

  const visibleEntries = useMemo(
    () =>
      jobFilter === "all"
        ? entries
        : entries.filter((e) => e.job_id === jobFilter),
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

  const monthSummary = useMemo(() => {
    const perJob = new Map<
      number,
      {
        name: string;
        color: string;
        done: number;
        planned: number;
        posts: Partial<Record<Platform, number>>;
      }
    >();
    for (const e of visibleEntries) {
      if (!e.entry_date.startsWith(monthPrefix)) continue;
      const row = perJob.get(e.job_id) ?? {
        name: e.job_name,
        color: e.job_color,
        done: 0,
        planned: 0,
        posts: {},
      };
      if (e.hours) {
        if (e.status === "done") row.done += e.hours;
        else row.planned += e.hours;
      }
      if (e.platform) {
        row.posts[e.platform] = (row.posts[e.platform] ?? 0) + 1;
      }
      perJob.set(e.job_id, row);
    }
    return [...perJob.values()].sort((a, b) => a.name.localeCompare(b.name));
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
    setSelectedDay(today);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyEntryForm(activeJobs[0] ? String(activeJobs[0].id) : ""));
  }

  function startEdit(entry: WorkEntry) {
    setEditingId(entry.id);
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
      link: form.link.trim() || null,
      hours,
      status: form.status,
    };

    setSaving(true);
    try {
      if (editingId === null) await createWorkEntry(payload);
      else await updateWorkEntry(editingId, payload);
      resetForm();
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
      if (editingId === entry.id) resetForm();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleJobSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const job = await createJob({
        name: jobName.trim(),
        client: jobClient.trim() || null,
        color: jobColor,
        status: "active",
      });
      setJobName("");
      setJobClient("");
      setJobColor(JOB_COLORS[(jobs.length + 1) % JOB_COLORS.length]);
      setShowJobForm(false);
      if (activeJobs.length === 0) {
        setForm((f) => ({ ...f, job_id: String(job.id) }));
      }
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


  // Jobs selectable in the form: active ones, plus the entry's own job when editing.
  const formJobs = jobs.filter(
    (job) => job.status === "active" || String(job.id) === formJobId
  );

  const monthName = new Intl.DateTimeFormat("en-IN", { month: "long" }).format(
    new Date(cursor.year, cursor.month, 1)
  );
  const selectedDate = new Date(`${selectedDay}T00:00:00`);
  const selectedWeekday = new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(selectedDate);
  const selectedDayMonth = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(selectedDate);
  const dayHours = dayEntries.reduce((sum, e) => sum + (e.hours ?? 0), 0);

  return (
    <div className="cal flex flex-col gap-6 lg:h-full">
      {error && (
        <div role="alert" className="cal-card flex shrink-0 items-center gap-3 px-4 py-3 text-[13px]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--dx-danger)]" />
          <span className="flex-1">{error}</span>
          <button type="button" className="cal-link-btn" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)_220px]">
        {/* ---------------- Month ---------------- */}
        <section className="cal-card flex flex-col px-3 pb-3 pt-4 sm:px-4 lg:col-start-1 lg:row-start-1 lg:min-h-0">
          <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 px-1">
            <h2 className="cal-title flex items-baseline gap-2" aria-live="polite">
              <span>
                {monthName}{" "}
                <span className="font-normal text-[var(--cal-tertiary)]">{cursor.year}</span>
              </span>
              {loading && (
                <span className="text-[12px] font-normal tracking-normal text-[var(--cal-tertiary)]">
                  Updating…
                </span>
              )}
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by job"
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="cal-select max-w-[180px]"
              >
                <option value="all">All jobs</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.name}{job.status === "archived" ? " (archived)" : ""}
                  </option>
                ))}
              </select>

              <div className="flex items-center">
                <button type="button" className="cal-icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                  <Chevron dir="left" />
                </button>
                <button type="button" className="cal-pill" onClick={goToday}>Today</button>
                <button type="button" className="cal-icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
                  <Chevron dir="right" />
                </button>
              </div>
            </div>
          </header>

          <div className="cal-grid-fit grid grid-cols-7 lg:min-h-0 lg:flex-1 lg:grid-rows-[auto_repeat(6,minmax(0,1fr))]">
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
                    setSelectedDay(iso);
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
                      <span key={e.id} className="cal-event-dot" style={{ backgroundColor: e.job_color, opacity: e.status === "planned" ? 0.4 : 1 }} />
                    ))}
                  </span>
                  <span className="hidden min-w-0 flex-col gap-[3px] sm:flex">
                    {items.slice(0, 2).map((e) => (
                      <span
                        key={e.id}
                        className={`cal-event ${e.status === "planned" ? "is-planned" : ""}`}
                        title={`${e.job_name}: ${e.description}`}
                      >
                        <span className="cal-event-dot" style={{ backgroundColor: e.job_color, color: e.job_color }} />
                        <span className="truncate">
                          {e.platform ? PLATFORM_LABELS[e.platform] : e.job_name}
                        </span>
                      </span>
                    ))}
                    {items.length > 2 && (
                      <span className="pl-[11px] text-[11px] text-[var(--cal-tertiary)]">
                        {items.length - 2} more
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

        </section>

        {/* ---------------- Day inspector ---------------- */}
        <aside className="cal-card flex flex-col gap-5 p-5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto">
          <header className="shrink-0">
            <p className={`cal-eyebrow ${selectedDay === today ? "!text-[var(--dx-danger)]" : ""}`}>
              {selectedDay === today ? "Today" : selectedWeekday}
            </p>
            <h2 className="mt-1 text-[22px] font-bold tracking-[-0.025em]">{selectedDayMonth}</h2>
            <p className="cal-caption mt-1">
              {dayEntries.length === 0
                ? "No entries"
                : `${dayEntries.length} ${dayEntries.length === 1 ? "entry" : "entries"}${dayHours ? ` · ${formatHours(dayHours)}` : ""}`}
            </p>
          </header>

          {dayEntries.length > 0 && (
            <ul className="cal-group cal-scroll max-h-[196px] lg:max-h-none lg:min-h-[64px]" aria-label="Entries for this day">
              {dayEntries.map((e) => (
                <li key={e.id} className="cal-entry">
                  <span className="cal-entry-bar" style={{ backgroundColor: e.job_color, opacity: e.status === "planned" ? 0.4 : 1 }} />
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">{e.description}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[12px] text-[var(--cal-secondary)]">{e.job_name}</span>
                      {e.platform && <span className="cal-tag">{PLATFORM_LABELS[e.platform]}</span>}
                      {e.status === "planned" && <span className="cal-tag">Planned</span>}
                      {e.hours != null && <span className="cal-tag">{formatHours(e.hours)}</span>}
                    </div>
                    {e.link && (
                      <a href={e.link} target="_blank" rel="noreferrer noopener" className="mt-1.5 block truncate text-[12px] text-[var(--dx-accent-text)] hover:underline">
                        {e.link.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                    <div className="mt-2 flex gap-4">
                      <button type="button" className="cal-link-btn" onClick={() => startEdit(e)}>Edit</button>
                      <button type="button" className="cal-link-btn is-danger" onClick={() => void handleDelete(e)}>Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {jobs.length === 0 ? (
            <p className="cal-group p-4 text-[13px] leading-relaxed text-[var(--cal-secondary)]">
              Create a job below, such as a client you post content for, and
              you can start logging work and posts here.
            </p>
          ) : (
            <form onSubmit={handleEntrySubmit} className="shrink-0 space-y-3 lg:mt-auto">
              <p className="cal-eyebrow">{editingId === null ? "New entry" : "Edit entry"}</p>

              <div className="cal-group">
                <label className="cal-row">
                  <span className="cal-row-label">Job</span>
                  <select value={formJobId} onChange={(e) => setForm({ ...form, job_id: e.target.value })} required className="cal-field">
                    <option value="" disabled>Select…</option>
                    {formJobs.map((job) => (
                      <option key={job.id} value={job.id}>{job.name}</option>
                    ))}
                  </select>
                </label>
                <label className="cal-row !items-start">
                  <span className="cal-row-label pt-[11px]">{form.platform ? "Posted" : "Work"}</span>
                  <textarea
                    rows={3}
                    required
                    maxLength={2000}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder={form.platform ? "What did you post?" : "What did you work on?"}
                    className="cal-field"
                  />
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
              </div>

              <div className="space-y-2">
                <p className="cal-caption">Platform</p>
                <div className="cal-segmented" role="group" aria-label="Platform">
                  {(["", ...PLATFORMS] as EntryForm["platform"][]).map((p) => (
                    <button key={p || "none"} type="button" aria-pressed={form.platform === p} onClick={() => setForm({ ...form, platform: p })}>
                      {p ? PLATFORM_LABELS[p] : "None"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="cal-segmented" role="group" aria-label="Status">
                  {(["done", "planned"] as WorkEntryStatus[]).map((s) => (
                    <button key={s} type="button" aria-pressed={form.status === s} onClick={() => setForm({ ...form, status: s })}>
                      {s === "done" ? "Done" : "Planned"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {editingId !== null && (
                    <button type="button" className="cal-pill" onClick={resetForm}>Cancel</button>
                  )}
                  <button type="submit" disabled={saving} className="cal-pill cal-pill-primary">
                    {saving ? "Saving…" : editingId === null ? "Add" : "Save"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </aside>

      <div className="grid gap-6 sm:grid-cols-2 lg:col-start-1 lg:row-start-2 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]">
        {/* ---------------- Month summary ---------------- */}
        <section className="cal-card flex h-[320px] flex-col p-5 lg:h-auto lg:min-h-0">
          <h2 className="cal-section-title">{monthName} at a glance</h2>
          <p className="cal-caption mt-1">Hours and posts by job this month.</p>
          {monthSummary.length === 0 ? (
            <p className="mt-5 text-[13px] text-[var(--cal-tertiary)]">Nothing logged this month.</p>
          ) : (
            <ul className="cal-group cal-scroll mt-4 min-h-0">
              {monthSummary.map((row) => (
                <li key={row.name} className="cal-row flex-wrap py-2.5">
                  <span className="cal-event-dot !h-2.5 !w-2.5" style={{ backgroundColor: row.color }} />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{row.name}</span>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {PLATFORMS.filter((p) => row.posts[p]).map((p) => (
                      <span key={p} className="cal-tag">{PLATFORM_LABELS[p]} {row.posts[p]}</span>
                    ))}
                    <span className="cal-tag !bg-transparent tabular-nums">
                      {formatHours(row.done)}
                      {row.planned > 0 ? ` + ${formatHours(row.planned)} planned` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------- Jobs ---------------- */}
        <section className="cal-card flex h-[320px] flex-col p-5 lg:h-auto lg:min-h-0">
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div>
              <h2 className="cal-section-title">Jobs</h2>
              <p className="cal-caption mt-1">All-time totals for each job.</p>
            </div>
            {jobs.length > 0 && (
              <button type="button" className="cal-pill" onClick={() => setShowJobForm((v) => !v)}>
                {showJobForm ? "Done" : "New job"}
              </button>
            )}
          </div>

          <div className="cal-scroll -mr-2 mt-4 min-h-0 flex-1 pr-2">
          {(showJobForm || jobs.length === 0) && (
            <form onSubmit={handleJobSubmit} className="mb-4 space-y-3">
              <div className="cal-group">
                <label className="cal-row">
                  <span className="cal-row-label">Name</span>
                  <input required maxLength={100} value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="e.g. Acme social media" className="cal-field" />
                </label>
                <label className="cal-row">
                  <span className="cal-row-label">Client</span>
                  <input maxLength={100} value={jobClient} onChange={(e) => setJobClient(e.target.value)} placeholder="Optional" className="cal-field" />
                </label>
                <div className="cal-row">
                  <span className="cal-row-label">Color</span>
                  <div className="flex flex-wrap gap-2.5 py-2.5" role="group" aria-label="Color">
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
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="cal-pill cal-pill-primary">Add job</button>
              </div>
            </form>
          )}

          {jobs.length > 0 && (
            <ul className="cal-group">
              {jobs.map((job) => (
                <li key={job.id} className="cal-row py-2.5">
                  <span className="cal-event-dot !h-2.5 !w-2.5" style={{ backgroundColor: job.color, opacity: job.status === "archived" ? 0.35 : 1 }} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[14px] ${job.status === "archived" ? "text-[var(--cal-tertiary)]" : ""}`}>
                      {job.name}
                    </p>
                    <p className="truncate text-[12px] text-[var(--cal-secondary)]">
                      {[
                        job.client,
                        `${formatHours(job.done_hours)} logged`,
                        `${job.post_count} ${job.post_count === 1 ? "post" : "posts"}`,
                        job.status === "archived" ? "Archived" : null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button type="button" className="cal-link-btn" onClick={() => void toggleArchive(job)}>
                    {job.status === "active" ? "Archive" : "Restore"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          </div>
        </section>
      </div>
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
