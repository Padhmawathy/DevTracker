import { useEffect, useState, type FormEvent } from "react";
import {
  createTask,
  getDeveloperProfile,
  getNotes,
  getTasks,
  getEvents,
  updateTask,
  type Note,
  type Task,
  type CalendarEvent,
  type EventColor,
} from "../services/api";
import JobMark from "../components/JobMark";
import { todayIso } from "../lib/dates";

const EVENT_COLOR: Record<EventColor, string> = {
  blue: "#0a84ff", green: "#30d158", orange: "#ff9f0a", red: "#ff453a",
  purple: "#bf5af2", pink: "#ff375f", teal: "#40c8e0", graphite: "#8e8e93",
};

function clock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, h, m));
}

/** Progress ring in the style of the app icon. */
function Ring({ done, total }: { done: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const fraction = total > 0 ? done / total : 0;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true" className="shrink-0">
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--ui-fill-strong)" strokeWidth="8" />
      <circle
        cx="34"
        cy="34"
        r={r}
        fill="none"
        stroke="#30d158"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${fraction * c} ${c}`}
        transform="rotate(-90 34 34)"
        style={{ transition: "stroke-dasharray 600ms ease-out" }}
      />
      {total > 0 && done === total && (
        <path d="M25 35l6 6 12-13" fill="none" stroke="#30d158" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function payload(task: Task, status: Task["status"]) {
  return {
    title: task.title,
    notes: task.notes,
    due_date: task.due_date,
    priority: task.priority,
    status,
    job_id: task.job_id,
    repeat: task.repeat ?? "none",
  };
}

export default function MobileToday({ onOpen }: { onOpen: (tab: "tasks" | "calendar" | "notes") => void }) {
  const today = todayIso();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTasks(), getEvents(today, today), getNotes(), getDeveloperProfile()])
      .then(([t, e, c, p]) => {
        if (cancelled) return;
        setName(p.display_name.trim());
        setTasks(t);
        setEvents(e);
        setNotes(c.slice(0, 3));
        setError("");
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [today, refreshKey]);

  // Due today or overdue and still open, plus what was finished today.
  const open = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date <= today);
  const doneToday = tasks.filter((t) => t.status === "done" && t.completed_at?.slice(0, 10) === today);
  const total = open.length + doneToday.length;

  async function toggle(task: Task) {
    try {
      await updateTask(task.id, payload(task, task.status === "done" ? "todo" : "done"));
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function quickAdd(event: FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    try {
      await createTask({ title: value, notes: null, due_date: today, priority: "none", status: "todo", job_id: null });
      setTitle("");
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[13px] font-medium text-[var(--ui-secondary)]">{dateLabel}</p>
        <h1 className="mt-0.5 text-[30px] font-bold leading-tight tracking-[-0.03em]">{name ? `${greeting}, ${name}` : greeting}</h1>
      </header>

      {error && <p role="alert" className="text-[13px] text-[var(--dx-danger)]">{error}</p>}

      <section className="ui-card flex items-center gap-4 p-4">
        <Ring done={doneToday.length} total={total} />
        <div className="min-w-0">
          <p className="text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
            {doneToday.length}
            <span className="text-[15px] font-normal text-[var(--ui-secondary)]"> of {total} done</span>
          </p>
          <p className="mt-1.5 text-[13px] text-[var(--ui-secondary)]">
            {total === 0
              ? "Nothing due today."
              : open.length === 0
                ? "All done for today 🎉"
                : `${open.length} to go`}
          </p>
        </div>
      </section>

      <form onSubmit={quickAdd} className="ui-card flex items-center gap-2 p-2 pl-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task for today"
          aria-label="New task for today"
          maxLength={200}
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--ui-tertiary)]"
        />
        <button type="submit" disabled={!title.trim()} className="ui-btn-primary h-10 px-4">Add</button>
      </form>

      <section className="ui-card p-2">
        <div className="flex items-center justify-between px-3 pb-1 pt-2">
          <h2 className="text-[15px] font-semibold">Due today</h2>
          <button type="button" onClick={() => onOpen("tasks")} className="text-[13px] font-medium text-[var(--dx-accent-text)]">All tasks</button>
        </div>
        {open.length === 0 && doneToday.length === 0 ? (
          <p className="px-3 pb-3 pt-1 text-[14px] text-[var(--ui-secondary)]">No tasks due. Enjoy the calm.</p>
        ) : (
          <ul>
            {[...open, ...doneToday].map((task) => {
              const done = task.status === "done";
              const overdue = !done && task.due_date! < today;
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => void toggle(task)}
                    aria-pressed={done}
                    className="flex min-h-[48px] w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left active:bg-[var(--ui-fill)]"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                        done ? "border-[#30d158] bg-[#30d158] text-white" : "border-[var(--ui-tertiary)]"
                      }`}
                    >
                      {done && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[15px] ${done ? "text-[var(--ui-tertiary)] line-through" : ""}`}>{task.title}</span>
                      {(overdue || task.job_name) && (
                        <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--ui-secondary)]">
                          {overdue && <span className="text-[var(--dx-danger)]">Overdue</span>}
                          {task.job_name && (
                            <>
                              <JobMark color={task.job_color} emoji={task.job_emoji} size="xs" />
                              <span className="truncate">{task.job_name}</span>
                            </>
                          )}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="ui-card p-2">
        <div className="flex items-center justify-between px-3 pb-1 pt-2">
          <h2 className="text-[15px] font-semibold">On the calendar</h2>
          <button type="button" onClick={() => onOpen("calendar")} className="text-[13px] font-medium text-[var(--dx-accent-text)]">Calendar</button>
        </div>
        {events.length === 0 ? (
          <p className="px-3 pb-3 pt-1 text-[14px] text-[var(--ui-secondary)]">No events today.</p>
        ) : (
          <ul>
            {events.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onOpen("calendar")} className="flex min-h-[48px] w-full items-stretch gap-3 rounded-[10px] px-3 py-2 text-left active:bg-[var(--ui-fill)]">
                  <span className="w-[4px] shrink-0 rounded-full" style={{ background: EVENT_COLOR[e.color] }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{e.title}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-[var(--ui-secondary)]">
                      {e.start_time ? `${clock(e.start_time)}${e.end_time ? ` – ${clock(e.end_time)}` : ""}` : "All day"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ui-card p-2">
        <div className="flex items-center justify-between px-3 pb-1 pt-2">
          <h2 className="text-[15px] font-semibold">Notes</h2>
          <button type="button" onClick={() => onOpen("notes")} className="text-[13px] font-medium text-[var(--dx-accent-text)]">
            {notes.length ? "All notes" : "New"}
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="px-3 pb-3 pt-1 text-[14px] text-[var(--ui-secondary)]">Jot down ideas and lists in Notes.</p>
        ) : (
          <ul>
            {notes.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => onOpen("notes")} className="flex min-h-[48px] w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left active:bg-[var(--ui-fill)]">
                  {n.pinned && <span aria-label="Pinned" className="text-[13px]">📌</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{n.title.trim() || n.body.trim().split(/\r?\n/)[0]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
