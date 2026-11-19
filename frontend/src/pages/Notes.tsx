import { useEffect, useMemo, useRef, useState } from "react";
import {
  createNote,
  deleteNote,
  getNotes,
  updateNote,
  type Note,
  type NoteColor,
  type NotePayload,
} from "../services/api";
import { todayIso } from "../lib/dates";
import { useBackClose } from "../lib/useBackClose";

const COLORS: { key: NoteColor; value: string | null; label: string }[] = [
  { key: "none", value: null, label: "No colour" },
  { key: "yellow", value: "#ffd60a", label: "Yellow" },
  { key: "green", value: "#30d158", label: "Green" },
  { key: "blue", value: "#0a84ff", label: "Blue" },
  { key: "pink", value: "#ff375f", label: "Pink" },
  { key: "purple", value: "#bf5af2", label: "Purple" },
];

const colorOf = (key: NoteColor) => COLORS.find((c) => c.key === key)?.value ?? null;

function tint(key: NoteColor): string | undefined {
  const c = colorOf(key);
  return c ? `color-mix(in srgb, ${c} 13%, var(--dx-surface))` : undefined;
}

function heading(note: Pick<Note, "title" | "body">): string {
  return note.title.trim() || note.body.trim().split("\n")[0] || "New note";
}

function preview(note: Note): string {
  const lines = note.body.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  return (note.title.trim() ? lines : lines.slice(1)).join(" ") || "No additional text";
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (iso.slice(0, 10) === todayIso()) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
  }
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(d);
}

type Draft = NotePayload & { id: number | null };

const EMPTY: Draft = { id: null, title: "", body: "", pinned: false, color: "none" };

function Editor({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [status, setStatus] = useState<"" | "saving" | "saved">("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const savedRef = useRef<string>(JSON.stringify(initial));
  const idRef = useRef<number | null>(initial.id);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Saves are chained so a note is never created twice.
  function save(next: Draft): Promise<void> {
    pending.current = pending.current.then(async () => {
      const snapshot = JSON.stringify({ ...next, id: idRef.current });
      if (snapshot === savedRef.current) return;
      if (!next.title.trim() && !next.body.trim()) return;
      setStatus("saving");
      try {
        const payload: NotePayload = { title: next.title, body: next.body, pinned: next.pinned, color: next.color };
        if (idRef.current === null) {
          idRef.current = (await createNote(payload)).id;
        } else {
          await updateNote(idRef.current, payload);
        }
        savedRef.current = JSON.stringify({ ...next, id: idRef.current });
        setStatus("saved");
        setError("");
      } catch (err) {
        setStatus("");
        setError((err as Error).message);
      }
    });
    return pending.current;
  }

  // Autosave shortly after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => void save(draft), 700);
    return () => clearTimeout(timer);
  }, [draft]);

  // Grow the text area with its content.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(240, el.scrollHeight)}px`;
  }, [draft.body]);

  async function done() {
    await save(draft);
    onClose();
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await pending.current;
    try {
      if (idRef.current !== null) await deleteNote(idRef.current);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  useBackClose(true, () => void done());

  return (
    <div className="cal space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => void done()} className="-ml-2 flex h-11 items-center gap-1 rounded-full px-2 text-[16px] font-medium text-[var(--dx-accent-text)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          Notes
        </button>
        <span className="text-[12px] text-[var(--ui-tertiary)]" aria-live="polite">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </span>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => set({ pinned: !draft.pinned })}
            aria-pressed={draft.pinned}
            aria-label={draft.pinned ? "Unpin note" : "Pin note"}
            className={`flex h-11 w-11 items-center justify-center rounded-full ${draft.pinned ? "text-[#ff9f0a]" : "text-[var(--ui-secondary)]"}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={draft.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true"><path d="M9 3h6l-1 6 4 3v2h-5l-1 7-1-7H6v-2l4-3-1-6Z" /></svg>
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            className={`h-11 rounded-full px-3 text-[15px] font-medium ${confirmDelete ? "text-[var(--dx-danger)]" : "text-[var(--ui-secondary)]"}`}
          >
            {confirmDelete ? "Tap to delete" : "Delete"}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="text-[13px] text-[var(--dx-danger)]">{error}</p>}

      <article className="ui-card space-y-2 p-4" style={{ background: tint(draft.color) }}>
        <input
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Title"
          aria-label="Title"
          maxLength={200}
          className="w-full bg-transparent text-[24px] font-bold tracking-[-0.02em] outline-none placeholder:text-[var(--ui-tertiary)]"
        />
        <textarea
          ref={bodyRef}
          autoFocus={initial.id === null}
          value={draft.body}
          onChange={(e) => set({ body: e.target.value })}
          placeholder="Start writing…"
          aria-label="Note"
          maxLength={20000}
          className="block w-full resize-none bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-[var(--ui-tertiary)]"
        />
      </article>

      <div className="flex items-center gap-3 px-1" role="group" aria-label="Note colour">
        {COLORS.map((c) => {
          const active = draft.color === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => set({ color: c.key })}
              aria-label={c.label}
              aria-pressed={active}
              className="flex h-9 w-9 items-center justify-center rounded-full"
            >
              <span
                className="block h-[22px] w-[22px] rounded-full"
                style={{
                  background: c.value ?? "var(--ui-fill-strong)",
                  boxShadow: active ? `0 0 0 2px var(--ui-page), 0 0 0 4px ${c.value ?? "var(--ui-tertiary)"}` : undefined,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getNotes()
      .then((list) => {
        if (!cancelled) {
          setNotes(list);
          setError("");
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = notes ?? [];
    return q ? list.filter((n) => `${n.title}\n${n.body}`.toLowerCase().includes(q)) : list;
  }, [notes, query]);

  if (editing) {
    return (
      <Editor
        initial={editing}
        onClose={() => {
          setEditing(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    );
  }

  const pinned = filtered.filter((n) => n.pinned);
  const others = filtered.filter((n) => !n.pinned);

  const section = (label: string, list: Note[]) =>
    list.length > 0 && (
      <section>
        <h2 className="px-1 pb-2 text-[13px] font-semibold text-[var(--ui-secondary)]">{label}</h2>
        <ul className="ui-card divide-y divide-[var(--ui-hairline)] overflow-hidden">
          {list.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => setEditing({ id: n.id, title: n.title, body: n.body, pinned: n.pinned, color: n.color })}
                className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-[var(--ui-fill)]"
                style={{ background: tint(n.color) }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{heading(n)}</span>
                  <span className="mt-0.5 flex gap-2 text-[14px] text-[var(--ui-secondary)]">
                    <span className="shrink-0 tabular-nums">{when(n.updated_at)}</span>
                    <span className="truncate">{preview(n)}</span>
                  </span>
                </span>
                {colorOf(n.color) && (
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(n.color)! }} aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em]">Notes</h1>
          <p className="text-[13px] text-[var(--ui-secondary)]">
            {notes === null ? "" : `${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
          </p>
        </div>
        <button type="button" onClick={() => setEditing(EMPTY)} className="ui-btn-primary h-10 px-4" aria-label="New note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          New
        </button>
      </header>

      {error && <p role="alert" className="text-[13px] text-[var(--dx-danger)]">{error}</p>}

      {(notes?.length ?? 0) > 0 && (
        <label className="flex h-10 items-center gap-2 rounded-[10px] bg-[var(--ui-fill)] px-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ui-tertiary)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" /></svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search notes"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--ui-tertiary)]"
          />
        </label>
      )}

      {notes !== null && notes.length === 0 && (
        <section className="ui-card px-6 py-10 text-center">
          <p className="text-[34px]" aria-hidden="true">📝</p>
          <p className="mt-2 text-[16px] font-semibold">No notes yet</p>
          <p className="mt-1 text-[14px] text-[var(--ui-secondary)]">Ideas, lists, anything worth remembering.</p>
          <button type="button" onClick={() => setEditing(EMPTY)} className="ui-btn-primary mt-5 h-10 px-5">Write a note</button>
        </section>
      )}

      {notes !== null && notes.length > 0 && filtered.length === 0 && (
        <p className="px-1 text-[14px] text-[var(--ui-secondary)]">No notes match “{query.trim()}”.</p>
      )}

      {section("Pinned", pinned)}
      {section(pinned.length ? "Notes" : "All notes", others)}
    </div>
  );
}
