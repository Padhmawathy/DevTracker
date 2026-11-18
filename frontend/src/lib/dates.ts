// Local-date helpers (YYYY-MM-DD in the user's time zone).

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

export function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export function dayLabel(iso: string): string {
  const today = todayIso();
  if (iso === today) return "Today";
  if (iso === shiftDay(today, -1)) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: iso.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}
