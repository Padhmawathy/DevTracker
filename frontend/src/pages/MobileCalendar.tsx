import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createEvent,
  deleteEvent,
  getEvents,
  getTasks,
  updateEvent,
  updateTask,
  type CalendarEvent,
  type EventColor,
  type EventPayload,
  type Repeat,
  type Task,
} from "../services/api";
import { todayIso } from "../lib/dates";
import { useBackClose } from "../lib/useBackClose";
import { ensureNotificationPermission } from "../services/reminders";
import "./calendar.css";

/** A personal calendar for the phone: events plus tasks with due dates. */

const EVENT_COLORS: { key: EventColor; value: string; label: string }[] = [
  { key: "blue", value: "#0a84ff", label: "Blue" },
  { key: "green", value: "#30d158", label: "Green" },
  { key: "orange", value: "#ff9f0a", label: "Orange" },
  { key: "red", value: "#ff453a", label: "Red" },
  { key: "purple", value: "#bf5af2", label: "Purple" },
  { key: "pink", value: "#ff375f", label: "Pink" },
  { key: "teal", value: "#40c8e0", label: "Teal" },
  { key: "graphite", value: "#8e8e93", label: "Graphite" },
];

const colorValue = (key: EventColor) => EVENT_COLORS.find((c) => c.key === key)?.value ?? "#0a84ff";
const TIMED_ALERTS: { value: number; label: string }[] = [
  { value: 0, label: "At time of event" },
  { value: 5, label: "5 minutes before" },
  { value: 10, label: "10 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 1440, label: "1 day before" },
  { value: 2880, label: "2 days before" },
  { value: 10080, label: "1 week before" },
];
const ALL_DAY_ALERTS: { value: number; label: string }[] = [
  { value: 0, label: "On the day (9:00 am)" },
  { value: 1440, label: "1 day before (9:00 am)" },
  { value: 2880, label: "2 days before (9:00 am)" },
  { value: 10080, label: "1 week before (9:00 am)" },
];

const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: "none", label: "Never" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Every weekday" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year" },
];

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parse(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

/** 6 weeks starting on the Monday on or before the 1st. */
function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return iso(d);
  });
}

function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, h, m));
}

function whenLabel(e: CalendarEvent): string {
  if (!e.start_time) return "All day";
  return e.end_time ? `${timeLabel(e.start_time)} – ${timeLabel(e.end_time)}` : timeLabel(e.start_time);
}

type Form = EventPayload & { id: number | null; allDay: boolean };

function alertFits(form: Form): boolean {
  return form.alert !== null && (form.allDay ? ALL_DAY_ALERTS : TIMED_ALERTS).some((a) => a.value === form.alert);
}

function newForm(date: string): Form {
  return { id: null, title: "", date, start_time: "09:00", end_time: "10:00", color: "blue", notes: null, alert: null, repeat: "none", repeat_until: null, allDay: true };
}

function EventForm({ initial, onDone }: { initial: Form; onDone: (changed: boolean, notice?: string) => void }) {
  const [form, setForm] = useState<Form>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  useBackClose(true, () => onDone(false));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || busy) return;
    setBusy(true);
    setError("");
    const payload: EventPayload = {
      title: form.title,
      date: form.date,
      start_time: form.allDay ? null : form.start_time || null,
      end_time: form.allDay || !form.start_time ? null : form.end_time || null,
      color: form.color,
      notes: form.notes,
      alert: alertFits(form) ? form.alert : null,
      repeat: form.repeat,
      repeat_until: form.repeat === "none" ? null : form.repeat_until,
    };
    try {
      const allowed = payload.alert === null || (await ensureNotificationPermission());
      if (form.id === null) await createEvent(payload);
      else await updateEvent(form.id, payload);
      onDone(true, allowed ? undefined : "Saved, but notifications are off for DevTrack, so the reminder won’t ring. Turn them on in Android Settings → Apps → DevTrack.");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const alerts = form.allDay ? ALL_DAY_ALERTS : TIMED_ALERTS;
  // Switching between all-day and timed keeps the reminder only if it still fits.
  const alertValue = form.alert !== null && alerts.some((a) => a.value === form.alert) ? String(form.alert) : "";

  async function remove() {
    if (form.id === null) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteEvent(form.id);
      onDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="cal-card space-y-3 p-4" aria-label={form.id === null ? "New event" : "Edit event"}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onDone(false)} className="h-9 text-[15px] text-[var(--dx-accent-text)]">Cancel</button>
        <p className="text-[15px] font-semibold">{form.id === null ? "New event" : "Edit event"}</p>
        <button type="submit" disabled={!form.title.trim() || busy} className="h-9 text-[15px] font-semibold text-[var(--dx-accent-text)] disabled:opacity-40">
          {form.id === null ? "Add" : "Save"}
        </button>
      </div>

      {error && <p role="alert" className="text-[13px] text-[var(--dx-danger)]">{error}</p>}

      <input
        autoFocus={form.id === null}
        value={form.title}
        onChange={(e) => set({ title: e.target.value })}
        placeholder="Title"
        aria-label="Title"
        maxLength={200}
        className="cal-field h-11 w-full text-[16px]"
      />

      <div className="divide-y divide-[var(--ui-hairline)] rounded-[12px] bg-[var(--ui-fill)]">
        <label className="flex h-12 items-center justify-between px-3 text-[15px]">
          Date
          <input type="date" value={form.date} onChange={(e) => e.target.value && set({ date: e.target.value })} className="bg-transparent text-right text-[15px] outline-none" />
        </label>
        <label className="flex h-12 items-center justify-between px-3 text-[15px]">
          All day
          <input type="checkbox" className="ui-switch" checked={form.allDay} onChange={(e) => set({ allDay: e.target.checked })} />
        </label>
        {!form.allDay && (
          <>
            <label className="flex h-12 items-center justify-between px-3 text-[15px]">
              Starts
              <input type="time" value={form.start_time ?? ""} onChange={(e) => set({ start_time: e.target.value })} className="bg-transparent text-right text-[15px] outline-none" />
            </label>
            <label className="flex h-12 items-center justify-between px-3 text-[15px]">
              Ends
              <input type="time" value={form.end_time ?? ""} onChange={(e) => set({ end_time: e.target.value })} className="bg-transparent text-right text-[15px] outline-none" />
            </label>
          </>
        )}
      </div>

      <div className="divide-y divide-[var(--ui-hairline)] rounded-[12px] bg-[var(--ui-fill)]">
        <label className="flex h-12 items-center justify-between gap-3 px-3 text-[15px]">
          <span className="flex items-center gap-2">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" /></svg>
            Repeat
          </span>
          <select
            value={form.repeat}
            onChange={(e) => set({ repeat: e.target.value as Repeat })}
            className="min-w-0 bg-transparent text-right text-[15px] text-[var(--ui-secondary)] outline-none"
          >
            {REPEAT_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        {form.repeat !== "none" && (
          <label className="flex h-12 items-center justify-between gap-3 px-3 text-[15px]">
            Ends
            <span className="flex items-center gap-2">
              <input
                type="date"
                value={form.repeat_until ?? ""}
                min={form.date}
                onChange={(e) => set({ repeat_until: e.target.value || null })}
                className="bg-transparent text-right text-[15px] text-[var(--ui-secondary)] outline-none"
                aria-label="Repeat until"
              />
              {!form.repeat_until && <span className="text-[13px] text-[var(--ui-tertiary)]">Never</span>}
            </span>
          </label>
        )}
      </div>

      <label className="flex h-12 items-center justify-between gap-3 rounded-[12px] bg-[var(--ui-fill)] px-3 text-[15px]">
        <span className="flex items-center gap-2">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          Remind me
        </span>
        <select
          value={alertValue}
          onChange={(e) => set({ alert: e.target.value === "" ? null : Number(e.target.value) })}
          className="min-w-0 bg-transparent text-right text-[15px] text-[var(--ui-secondary)] outline-none"
        >
          <option value="">Never</option>
          {alerts.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Colour">
        {EVENT_COLORS.map((c) => {
          const active = form.color === c.key;
          return (
            <button key={c.key} type="button" onClick={() => set({ color: c.key })} aria-label={c.label} aria-pressed={active} className="flex h-10 w-10 items-center justify-center rounded-full">
              <span
                className="block h-[24px] w-[24px] rounded-full"
                style={{ background: c.value, boxShadow: active ? `0 0 0 2px var(--dx-surface), 0 0 0 4px ${c.value}` : undefined }}
              />
            </button>
          );
        })}
      </div>

      <textarea
        value={form.notes ?? ""}
        onChange={(e) => set({ notes: e.target.value || null })}
        placeholder="Notes"
        aria-label="Notes"
        rows={3}
        maxLength={4000}
        className="cal-field w-full py-2.5 text-[15px]"
      />

      {form.id !== null && (
        <button
          type="button"
          onClick={() => void remove()}
          className="h-11 w-full rounded-[12px] bg-[var(--ui-fill)] text-[15px] font-medium text-[var(--dx-danger)]"
        >
          {confirmDelete ? "Tap again to delete" : "Delete event"}
        </button>
      )}
    </form>
  );
}

export default function MobileCalendar() {
  const today = todayIso();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getEvents(days[0], days[days.length - 1]), getTasks()])
      .then(([e, t]) => {
        if (cancelled) return;
        setEvents(e);
        setTasks(t.filter((task) => task.due_date));
        setError("");
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [days, refreshKey]);

  const byDay = useMemo(() => {
    const map = new Map<string, { events: CalendarEvent[]; tasks: Task[] }>();
    const slot = (d: string) => {
      let v = map.get(d);
      if (!v) map.set(d, (v = { events: [], tasks: [] }));
      return v;
    };
    for (const e of events) slot(e.date).events.push(e);
    for (const t of tasks) slot(t.due_date!).tasks.push(t);
    return map;
  }, [events, tasks]);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setForm(null);
  }

  function goToday() {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(today);
    setForm(null);
  }

  async function toggleTask(task: Task) {
    try {
      await updateTask(task.id, {
        title: task.title,
        notes: task.notes,
        due_date: task.due_date,
        priority: task.priority,
        status: task.status === "done" ? "todo" : "done",
        job_id: task.job_id,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(cursor.year, cursor.month, 1));
  const selectedLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(parse(selected));
  const day = byDay.get(selected) ?? { events: [], tasks: [] };

  return (
    <div className="cal space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em]">{monthLabel}</h1>
        <div className="flex items-center">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="flex h-11 w-10 items-center justify-center text-[var(--dx-accent-text)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" onClick={goToday} className="h-9 rounded-full px-3 text-[14px] font-semibold text-[var(--dx-accent-text)]">Today</button>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="flex h-11 w-10 items-center justify-center text-[var(--dx-accent-text)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </header>

      {error && <p role="alert" className="text-[13px] text-[var(--dx-danger)]">{error}</p>}
      {notice && <p role="status" className="rounded-[12px] bg-[color-mix(in_srgb,#ff9f0a_14%,transparent)] px-3 py-2 text-[13px]">{notice}</p>}

      <section className="cal-card p-2" aria-label={monthLabel}>
        <div className="grid grid-cols-7 pb-1">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className={`text-center text-[11px] font-semibold ${i >= 5 ? "text-[var(--ui-tertiary)]" : "text-[var(--ui-secondary)]"}`}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const inMonth = parse(d).getMonth() === cursor.month;
            const isToday = d === today;
            const isSelected = d === selected;
            const items = byDay.get(d);
            const dots = [
              ...(items?.events ?? []).map((e) => colorValue(e.color)),
              ...(items?.tasks ?? []).filter((t) => t.status !== "done").map(() => "var(--ui-tertiary)"),
            ].slice(0, 3);
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSelected(d);
                  setForm(null);
                }}
                aria-label={new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(parse(d))}
                aria-pressed={isSelected}
                className="flex h-[50px] flex-col items-center justify-start gap-1 pt-1"
              >
                <span
                  className={`flex h-[30px] w-[30px] items-center justify-center rounded-full text-[15px] tabular-nums ${
                    isSelected
                      ? isToday
                        ? "bg-[#ff453a] font-bold text-white"
                        : "bg-[var(--dx-heading)] font-bold text-[var(--dx-surface)]"
                      : isToday
                        ? "font-bold text-[#ff453a]"
                        : inMonth
                          ? "text-[var(--dx-heading)]"
                          : "text-[var(--ui-tertiary)]"
                  }`}
                >
                  {parse(d).getDate()}
                </span>
                <span className="flex h-[5px] gap-[3px]" aria-hidden="true">
                  {dots.map((c, i) => (
                    <span key={i} className="h-[5px] w-[5px] rounded-full" style={{ background: c, opacity: inMonth ? 1 : 0.4 }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {form ? (
        <EventForm
          key={form.id ?? `new-${form.date}`}
          initial={form}
          onDone={(changed, message) => {
            setForm(null);
            setNotice(message ?? "");
            if (changed) setRefreshKey((k) => k + 1);
          }}
        />
      ) : (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[17px] font-semibold">{selected === today ? `Today · ${selectedLabel}` : selectedLabel}</h2>
            <button type="button" onClick={() => setForm(newForm(selected))} className="ui-btn-primary h-9 px-3.5" aria-label="New event">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Event
            </button>
          </div>

          {day.events.length === 0 && day.tasks.length === 0 ? (
            <div className="cal-card px-4 py-6 text-center text-[14px] text-[var(--ui-secondary)]">Nothing planned. A free day ✨</div>
          ) : (
            <ul className="cal-card divide-y divide-[var(--ui-hairline)] overflow-hidden">
              {day.events.map((e) => (
                <li key={`e${e.id}-${e.date}`}>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        id: e.id,
                        title: e.title,
                        // Editing a repeating event edits the whole series.
                        date: e.series_start ?? e.date,
                        start_time: e.start_time ?? "09:00",
                        end_time: e.end_time ?? (e.start_time ? null : "10:00"),
                        color: e.color,
                        notes: e.notes,
                        alert: e.alert ?? null,
                        repeat: e.repeat ?? "none",
                        repeat_until: e.repeat_until ?? null,
                        allDay: !e.start_time,
                      })
                    }
                    className="flex w-full items-stretch gap-3 px-4 py-3 text-left active:bg-[var(--ui-fill)]"
                  >
                    <span className="w-[4px] shrink-0 rounded-full" style={{ background: colorValue(e.color) }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-medium">{e.title}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-[var(--ui-secondary)]">
                        {e.repeat && e.repeat !== "none" ? "🔁 " : ""}
                        {e.alert != null ? "🔔 " : ""}
                        {whenLabel(e)}
                        {e.notes ? ` · ${e.notes}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {day.tasks.map((t) => {
                const done = t.status === "done";
                return (
                  <li key={`t${t.id}`}>
                    <button
                      type="button"
                      onClick={() => void toggleTask(t)}
                      aria-pressed={done}
                      className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-[var(--ui-fill)]"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${done ? "border-[#30d158] bg-[#30d158] text-white" : "border-[var(--ui-tertiary)]"}`}
                      >
                        {done && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[15px] ${done ? "text-[var(--ui-tertiary)] line-through" : ""}`}>{t.title}</span>
                        <span className="block text-[12px] text-[var(--ui-secondary)]">Task due</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
