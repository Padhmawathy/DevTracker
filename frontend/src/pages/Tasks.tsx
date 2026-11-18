import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  createTask,
  deleteTask,
  getJobs,
  getTasks,
  updateTask,
  type Job,
  type Task,
  type TaskPayload,
  type TaskPriority,
  type TaskStatus,
} from "../services/api";
import "./calendar.css";

type SmartList = "today" | "scheduled" | "all" | "completed";
type ListKey = SmartList | `job:${number}`;

const SMART_LISTS: { key: SmartList; label: string; color: string; icon: string }[] = [
  { key: "today", label: "Today", color: "#0a84ff", icon: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" },
  { key: "scheduled", label: "Scheduled", color: "#ff453a", icon: "M4 9h16M8 3v4M16 3v4M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" },
  { key: "all", label: "All", color: "#636366", icon: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" },
  { key: "completed", label: "Completed", color: "#30d158", icon: "m5 12 4.5 4.5L19 7" },
];

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const PRIORITY_MARK: Record<TaskPriority, string> = {
  none: "",
  low: "!",
  medium: "!!",
  high: "!!!",
};

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

function dueLabel(due: string, today: string): { text: string; overdue: boolean } {
  if (due === today) return { text: "Today", overdue: false };
  if (due === addDays(today, 1)) return { text: "Tomorrow", overdue: false };
  if (due === addDays(today, -1)) return { text: "Yesterday", overdue: true };
  const text = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    new Date(`${due}T00:00:00`)
  );
  return { text, overdue: due < today };
}

type Draft = {
  title: string;
  notes: string;
  due_date: string;
  priority: TaskPriority;
  status: TaskStatus;
  job_id: string;
};

function toDraft(task: Task): Draft {
  return {
    title: task.title,
    notes: task.notes ?? "",
    due_date: task.due_date ?? "",
    priority: task.priority,
    status: task.status,
    job_id: task.job_id == null ? "" : String(task.job_id),
  };
}

function draftToPayload(draft: Draft): TaskPayload {
  return {
    title: draft.title.trim(),
    notes: draft.notes.trim() || null,
    due_date: draft.due_date || null,
    priority: draft.priority,
    status: draft.status,
    job_id: draft.job_id ? Number(draft.job_id) : null,
  };
}

function taskToPayload(task: Task, overrides: Partial<TaskPayload> = {}): TaskPayload {
  return {
    title: task.title,
    notes: task.notes,
    due_date: task.due_date,
    priority: task.priority,
    status: task.status,
    job_id: task.job_id,
    ...overrides,
  };
}

export default function Tasks() {
  const today = toIso(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [listKey, setListKey] = useState<ListKey>("today");
  const [showCompleted, setShowCompleted] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const quickRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [taskList, jobList] = await Promise.all([getTasks(), getJobs()]);
        if (cancelled) return;
        setTasks(taskList);
        setJobs(jobList);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Unable to load tasks.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const activeJobs = useMemo(() => jobs.filter((j) => j.status === "active"), [jobs]);

  const open = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);

  const counts = useMemo(() => {
    const byJob = new Map<number, number>();
    for (const t of open) {
      if (t.job_id != null) byJob.set(t.job_id, (byJob.get(t.job_id) ?? 0) + 1);
    }
    return {
      today: open.filter((t) => t.due_date && t.due_date <= today).length,
      scheduled: open.filter((t) => t.due_date).length,
      all: open.length,
      completed: tasks.length - open.length,
      byJob,
    };
  }, [open, tasks.length, today]);

  const jobFilter = listKey.startsWith("job:") ? Number(listKey.slice(4)) : null;

  const { visible, completedInList } = useMemo(() => {
    switch (listKey) {
      case "today":
        return { visible: open.filter((t) => t.due_date && t.due_date <= today), completedInList: [] };
      case "scheduled":
        return { visible: open.filter((t) => t.due_date), completedInList: [] };
      case "all":
        return { visible: open, completedInList: [] };
      case "completed":
        return { visible: tasks.filter((t) => t.status === "done"), completedInList: [] };
      default:
        return {
          visible: open.filter((t) => t.job_id === jobFilter),
          completedInList: tasks.filter((t) => t.status === "done" && t.job_id === jobFilter),
        };
    }
  }, [listKey, open, tasks, today, jobFilter]);

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;
  const currentJob = jobFilter != null ? jobs.find((j) => j.id === jobFilter) : undefined;
  const smart = SMART_LISTS.find((l) => l.key === listKey);
  const listTitle = smart?.label ?? currentJob?.name ?? "Tasks";
  const listColor = smart?.color ?? currentJob?.color ?? "#0a84ff";

  const dirty =
    !!selectedTask && !!draft &&
    JSON.stringify(draftToPayload(draft)) !== JSON.stringify(taskToPayload(selectedTask));

  function selectTask(task: Task | null) {
    setSelectedId(task?.id ?? null);
    setDraft(task ? toDraft(task) : null);
  }

  function chooseList(key: ListKey) {
    setListKey(key);
    setShowCompleted(false);
    selectTask(null);
  }

  function replaceTask(updated: Task) {
    setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function handleQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title || listKey === "completed") return;
    setAdding(true);
    setError("");
    try {
      const created = await createTask({
        title,
        notes: null,
        due_date: listKey === "today" ? today : null,
        priority: "none",
        status: "todo",
        job_id: jobFilter,
      });
      setTasks((current) => [...current, created]);
      setQuickTitle("");
      quickRef.current?.focus();
      setRefreshKey((k) => k + 1); // re-sort from the server
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function toggleDone(task: Task) {
    setError("");
    const status: TaskStatus = task.status === "done" ? "todo" : "done";
    try {
      const updated = await updateTask(task.id, taskToPayload(task, { status }));
      replaceTask(updated);
      if (selectedId === task.id) setDraft(toDraft(updated));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask || !draft) return;
    if (!draft.title.trim()) {
      setError("Task title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await updateTask(selectedTask.id, draftToPayload(draft));
      replaceTask(updated);
      setDraft(toDraft(updated));
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedTask) return;
    setError("");
    try {
      await deleteTask(selectedTask.id);
      setTasks((current) => current.filter((t) => t.id !== selectedTask.id));
      selectTask(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const editorJobs = jobs.filter((j) => j.status === "active" || String(j.id) === draft?.job_id);

  function renderRow(task: Task) {
    const done = task.status === "done";
    const due = task.due_date ? dueLabel(task.due_date, today) : null;
    const selected = task.id === selectedId;
    return (
      <li key={task.id}>
        <div
          className={[
            "flex items-start gap-3 rounded-[10px] px-3 py-2.5 transition-colors",
            selected ? "bg-[var(--dx-accent-soft)]" : "hover:bg-[var(--ui-fill)]",
          ].join(" ")}
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
            onClick={() => void toggleDone(task)}
            className="mt-[1px] flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full transition-colors"
            style={{
              boxShadow: `inset 0 0 0 1.5px ${done ? listColor : "var(--ui-tertiary)"}`,
              backgroundColor: done ? listColor : "transparent",
            }}
          >
            {done && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 12 4.5 4.5L19 7" />
              </svg>
            )}
          </button>

          <button type="button" onClick={() => selectTask(task)} className="min-w-0 flex-1 text-left">
            <p className={`text-[14px] leading-snug ${done ? "text-[var(--ui-tertiary)] line-through" : "text-[var(--dx-heading)]"}`}>
              {task.priority !== "none" && !done && (
                <span className="mr-1 font-semibold text-[var(--dx-warning)]">{PRIORITY_MARK[task.priority]}</span>
              )}
              {task.title}
            </p>
            {(due || task.job_name || task.status === "in_progress" || task.notes) && (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--ui-secondary)]">
                {task.status === "in_progress" && (
                  <span className="font-medium text-[var(--dx-accent-text)]">In progress</span>
                )}
                {due && (
                  <span className={due.overdue && !done ? "text-[var(--dx-danger)]" : ""}>{due.text}</span>
                )}
                {task.job_name && (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.job_color ?? undefined }} />
                    {task.job_name}
                  </span>
                )}
                {task.notes && <span className="truncate">{task.notes.split("\n")[0]}</span>}
              </p>
            )}
          </button>
        </div>
      </li>
    );
  }

  const detailsOpen = !!selectedTask && !!draft;

  return (
    <div className="cal flex flex-col gap-4 lg:h-full">
      {error && (
        <div role="alert" className="flex shrink-0 items-center gap-3 px-1 text-[13px] text-[var(--dx-danger)]">
          <span className="flex-1">{error}</span>
          <button type="button" className="cal-link-btn" onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      <div
        className={[
          "grid gap-6 lg:min-h-0 lg:flex-1",
          detailsOpen
            ? "lg:grid-cols-[200px_minmax(0,1fr)_320px]"
            : "lg:grid-cols-[200px_minmax(0,1fr)]",
        ].join(" ")}
      >
        {/* ---------------- Lists ---------------- */}
        <nav aria-label="Task lists" className="cal-scroll flex gap-1 overflow-x-auto lg:min-h-0 lg:flex-col lg:overflow-x-hidden">
          {SMART_LISTS.map((list) => (
            <ListButton
              key={list.key}
              active={listKey === list.key}
              onClick={() => chooseList(list.key)}
              color={list.color}
              icon={list.icon}
              label={list.label}
              count={counts[list.key]}
            />
          ))}

          {activeJobs.length > 0 && (
            <>
              <p className="hidden px-2.5 pb-1 pt-5 text-[12px] font-medium text-[var(--ui-tertiary)] lg:block">Jobs</p>
              <span className="mx-1 w-px shrink-0 self-stretch bg-[var(--ui-hairline)] lg:hidden" aria-hidden="true" />
              {activeJobs.map((job) => (
                <ListButton
                  key={job.id}
                  active={listKey === `job:${job.id}`}
                  onClick={() => chooseList(`job:${job.id}`)}
                  color={job.color}
                  label={job.name}
                  count={counts.byJob.get(job.id) ?? 0}
                />
              ))}
            </>
          )}
        </nav>

        {/* ---------------- Task list ---------------- */}
        <section className="cal-card flex min-h-[360px] flex-col p-4 lg:min-h-0">
          <header className="flex shrink-0 items-baseline justify-between gap-3 px-2 pb-2">
            <h2 className="text-[22px] font-bold tracking-[-0.025em]">{listTitle}</h2>
            <span className="text-[15px] tabular-nums text-[var(--ui-tertiary)]">{visible.length}</span>
          </header>

          {listKey !== "completed" && (
            <form onSubmit={handleQuickAdd} className="mb-1 flex shrink-0 items-center gap-3 rounded-[10px] px-3 py-2 focus-within:bg-[var(--ui-fill)]">
              <span
                className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[15px] leading-none text-[var(--ui-tertiary)] shadow-[inset_0_0_0_1.5px_var(--ui-tertiary)]"
                aria-hidden="true"
              >
                +
              </span>
              <input
                ref={quickRef}
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                maxLength={200}
                disabled={adding}
                placeholder={listKey === "today" ? "New task for today" : currentJob ? `New task for ${currentJob.name}` : "New task"}
                aria-label="New task title"
                className="cal-field !py-1"
              />
            </form>
          )}

          <div className="cal-scroll -mx-1 min-h-0 flex-1 px-1">
            {loading && tasks.length === 0 ? (
              <p className="px-3 py-6 text-[13px] text-[var(--ui-tertiary)]">Loading…</p>
            ) : visible.length === 0 ? (
              <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-center">
                <p className="text-[14px] text-[var(--ui-tertiary)]">
                  {listKey === "completed" ? "No completed tasks" : "All clear"}
                </p>
              </div>
            ) : (
              <ul className="space-y-px">{visible.map(renderRow)}</ul>
            )}

            {completedInList.length > 0 && (
              <div className="mt-3 px-3">
                <button type="button" className="cal-link-btn" onClick={() => setShowCompleted((v) => !v)}>
                  {showCompleted ? "Hide" : "Show"} {completedInList.length} completed
                </button>
                {showCompleted && <ul className="-mx-3 mt-2 space-y-px">{completedInList.map(renderRow)}</ul>}
              </div>
            )}
          </div>
        </section>

        {/* ---------------- Details (only when a task is selected) ---------------- */}
        {detailsOpen && selectedTask && draft && (
          <aside className="cal-card flex flex-col p-5 lg:min-h-0">
            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex shrink-0 items-center justify-between">
                <button type="button" className="cal-link-btn is-danger" onClick={() => void handleDelete()}>
                  Delete
                </button>
                <button type="button" className="cal-icon-btn" onClick={() => selectTask(null)} aria-label="Close details">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <div className="cal-scroll -mr-2 min-h-0 flex-1 space-y-4 pr-2">
                <div className="cal-group">
                  <label className="cal-row">
                    <span className="sr-only">Title</span>
                    <input
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      maxLength={200}
                      required
                      className="cal-field text-[15px] font-semibold"
                    />
                  </label>
                  <label className="cal-row !items-start">
                    <span className="sr-only">Notes</span>
                    <textarea
                      rows={3}
                      maxLength={4000}
                      value={draft.notes}
                      onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                      placeholder="Notes"
                      className="cal-field"
                    />
                  </label>
                </div>

                <div className="cal-group">
                  <label className="cal-row">
                    <span className="cal-row-label">Due</span>
                    <input
                      type="date"
                      value={draft.due_date}
                      onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                      className="cal-field"
                    />
                    {draft.due_date && (
                      <button type="button" className="cal-link-btn shrink-0" onClick={() => setDraft({ ...draft, due_date: "" })}>
                        Clear
                      </button>
                    )}
                  </label>
                  <label className="cal-row">
                    <span className="cal-row-label">Job</span>
                    <select value={draft.job_id} onChange={(e) => setDraft({ ...draft, job_id: e.target.value })} className="cal-field">
                      <option value="">None</option>
                      {editorJobs.map((job) => (
                        <option key={job.id} value={job.id}>{job.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="cal-row">
                    <span className="cal-row-label">Priority</span>
                    <select
                      value={draft.priority}
                      onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })}
                      className="cal-field"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="cal-row">
                    <span className="cal-row-label">Status</span>
                    <select
                      value={draft.status}
                      onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })}
                      className="cal-field"
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {dirty && (
                <div className="flex shrink-0 justify-end gap-2">
                  <button type="button" className="cal-pill" onClick={() => setDraft(toDraft(selectedTask))}>
                    Revert
                  </button>
                  <button type="submit" disabled={saving} className="cal-pill cal-pill-primary">
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}

function ListButton({
  active, onClick, color, icon, label, count,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  icon?: string;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={[
        "flex h-9 shrink-0 items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[14px] transition-colors lg:w-full",
        active ? "bg-[var(--ui-fill-strong)] font-medium text-[var(--dx-heading)]" : "text-[var(--dx-body)] hover:bg-[var(--ui-fill)]",
      ].join(" ")}
    >
      {icon ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <path d={icon} />
        </svg>
      ) : (
        <span className="mx-[4px] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count > 0 && <span className="text-[12px] tabular-nums text-[var(--ui-tertiary)]">{count}</span>}
    </button>
  );
}
