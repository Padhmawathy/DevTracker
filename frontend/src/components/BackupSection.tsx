import { useState } from "react";
import {
  exportBackup,
  getLastBackup,
  parseBackup,
  pickBackup,
  restoreBackup,
  type BackupSummary,
} from "../services/backup";
import type { StoreData } from "../services/localStore";

function ago(iso: string | null, now: number): string {
  if (!iso) return "Never backed up";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Never backed up";
  const days = Math.floor((now - then.getTime()) / 86_400_000);
  if (days <= 0) return "Backed up today";
  if (days === 1) return "Backed up yesterday";
  return `Backed up ${days} days ago`;
}

function count(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ui-tertiary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

/** More → Backup: save everything to a file, or restore from one. */
export default function BackupSection() {
  const [last, setLast] = useState(getLastBackup);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<{ data: StoreData; summary: BackupSummary } | null>(null);

  async function doExport() {
    setBusy(true);
    setMessage(null);
    try {
      if (await exportBackup()) {
        setLast(getLastBackup());
        setNow(Date.now());
        setMessage({ tone: "ok", text: "Backup saved. Keep it somewhere safe, like Google Drive." });
      }
    } catch (err) {
      setMessage({ tone: "error", text: `Couldn’t save the backup: ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile() {
    setMessage(null);
    try {
      const text = await pickBackup();
      if (text !== null) setPending(parseBackup(text));
    } catch (err) {
      setMessage({ tone: "error", text: (err as Error).message });
    }
  }

  async function confirmRestore() {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(pending.data);
      // Reload so every screen shows the restored data.
      window.location.reload();
    } catch (err) {
      setMessage({ tone: "error", text: `Couldn’t restore: ${(err as Error).message}` });
      setBusy(false);
    }
  }

  const stale = !last || now - new Date(last).getTime() > 14 * 86_400_000;

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[13px] font-semibold text-[var(--ui-secondary)]">Backup</h2>
      <div className="ui-card divide-y divide-[var(--ui-hairline)] overflow-hidden">
        <button type="button" disabled={busy} onClick={() => void doExport()} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-[var(--ui-fill)] disabled:opacity-50">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#0a84ff] text-white" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px]">Export backup</span>
            <span className={`block text-[12px] ${stale ? "text-[#ff9f0a]" : "text-[var(--ui-secondary)]"}`}>{ago(last, now)}</span>
          </span>
          <Chevron />
        </button>
        <button type="button" disabled={busy} onClick={() => void chooseFile()} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-[var(--ui-fill)] disabled:opacity-50">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#30d158] text-white" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px]">Restore from backup</span>
            <span className="block text-[12px] text-[var(--ui-secondary)]">Replaces what’s on this phone</span>
          </span>
          <Chevron />
        </button>
      </div>

      {pending && (
        <div className="ui-card space-y-3 p-4" role="alertdialog" aria-label="Restore backup?">
          <p className="text-[15px] font-semibold">Replace everything with this backup?</p>
          <p className="text-[14px] leading-relaxed text-[var(--ui-secondary)]">
            It has {count(pending.summary.tasks, "task")}, {count(pending.summary.events, "event")} and {count(pending.summary.notes, "note")}
            {pending.summary.exportedAt
              ? `, saved ${new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(pending.summary.exportedAt))}`
              : ""}
            . What’s on this phone now will be replaced.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPending(null)} className="ui-btn h-10 flex-1">Cancel</button>
            <button type="button" disabled={busy} onClick={() => void confirmRestore()} className="h-10 flex-1 rounded-full bg-[var(--dx-danger)] text-[15px] font-semibold text-white disabled:opacity-50">
              {busy ? "Restoring…" : "Replace"}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`px-1 text-[13px] ${message.tone === "error" ? "text-[var(--dx-danger)]" : "text-[#30d158]"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
