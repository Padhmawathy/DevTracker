import { dayLabel, shiftDay, todayIso } from "../lib/dates";

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}

/** Compact day switcher: ‹ Today ›, with a native date picker behind the label. */
export default function DateNav({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const isToday = value >= todayIso();
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-full text-[var(--ui-secondary)] transition-colors hover:bg-[var(--ui-fill)] hover:text-[var(--dx-heading)] disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="flex items-center gap-1">
      <button type="button" className={btn} onClick={() => onChange(shiftDay(value, -1))} aria-label="Previous day">
        <Chevron dir="left" />
      </button>

      <label className="relative min-w-[96px] cursor-pointer rounded-full px-3 py-1 text-center text-[15px] font-semibold text-[var(--dx-heading)] hover:bg-[var(--ui-fill)]">
        {dayLabel(value)}
        <input
          type="date"
          value={value}
          max={todayIso()}
          aria-label="Choose a date"
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      <button type="button" className={btn} onClick={() => onChange(shiftDay(value, 1))} disabled={isToday} aria-label="Next day">
        <Chevron dir="right" />
      </button>

      {!isToday && (
        <button type="button" onClick={() => onChange(todayIso())} className="ml-1 text-[13px] font-medium text-[var(--dx-accent-text)] hover:opacity-75">
          Today
        </button>
      )}
    </div>
  );
}
