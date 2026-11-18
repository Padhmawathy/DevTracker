import type { ReactNode } from "react";

/**
 * The phone app's floating tab bar.
 * Each tab has its own colour (taken from the app icon's palette). The active
 * tab's icon fills in and sits in a soft tinted capsule with its label.
 */
export type TabKey = "today" | "tasks" | "calendar" | "notes" | "more";

type IconProps = { active: boolean; color: string };

/** A mini version of the app icon's progress ring. */
function TodayIcon({ active }: IconProps) {
  const ring = (stroke: string, dash: string, offset: number) => (
    <circle cx="12" cy="12" r="8" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={offset} transform="rotate(-90 12 12)" />
  );
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      {active ? (
        <>
          {ring("#0a84ff", "15.5 34.8", 0)}
          {ring("#30d158", "12 38.3", -20.3)}
          {ring("#ff9f0a", "8 42.3", -37.5)}
        </>
      ) : (
        ring("currentColor", "38 12.3", 0)
      )}
      <path d="M9.2 12.3l1.9 1.9 3.8-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.9} />
    </svg>
  );
}

function TasksIcon({ active, color }: IconProps) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill={active ? color : "none"} stroke={active ? color : "currentColor"} strokeWidth="1.8" />
      <path d="m8 12.2 2.8 2.8L16.2 9.5" fill="none" stroke={active ? "#fff" : "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Shows today's date, like a real calendar page. */
function CalendarIcon({ active, color }: IconProps) {
  const day = new Date().getDate();
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="16" rx="4" fill={active ? "var(--dx-surface)" : "none"} stroke={active ? color : "currentColor"} strokeWidth="1.8" />
      <path d="M3.5 9.5V8.5a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v1Z" fill={active ? color : "currentColor"} />
      <text x="12" y="18.2" textAnchor="middle" fontSize="8.2" fontWeight="700" fill={active ? color : "currentColor"} style={{ fontFamily: "inherit" }}>
        {day}
      </text>
    </svg>
  );
}

function NotesIcon({ active, color }: IconProps) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 3.5h8l4 4v11a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" fill={active ? color : "none"} stroke={active ? color : "currentColor"} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 11.5h7M8.5 15h4.5" stroke={active ? "#3a2e00" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Four rounded tiles, each in a colour of the palette when active. */
function MoreIcon({ active }: IconProps) {
  const tiles = [
    { x: 4, y: 4, c: "#0a84ff" },
    { x: 13, y: 4, c: "#30d158" },
    { x: 4, y: 13, c: "#ff9f0a" },
    { x: 13, y: 13, c: "#bf5af2" },
  ];
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      {tiles.map((t) => (
        <rect key={`${t.x}${t.y}`} x={t.x} y={t.y} width="7" height="7" rx="2.2" fill={active ? t.c : "none"} stroke={active ? t.c : "currentColor"} strokeWidth="1.7" />
      ))}
    </svg>
  );
}

const TABS: { key: TabKey; label: string; color: string; Icon: (p: IconProps) => ReactNode }[] = [
  { key: "today", label: "Today", color: "#0a84ff", Icon: TodayIcon },
  { key: "tasks", label: "Tasks", color: "#30d158", Icon: TasksIcon },
  { key: "calendar", label: "Calendar", color: "#ff453a", Icon: CalendarIcon },
  { key: "notes", label: "Notes", color: "#ffd60a", Icon: NotesIcon },
  { key: "more", label: "More", color: "#bf5af2", Icon: MoreIcon },
];

export default function TabBar({ active, onSelect }: { active: TabKey; onSelect: (tab: TabKey) => void }) {
  return (
    <nav
      aria-label="Sections"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
    >
      <ul
        className="pointer-events-auto mx-auto flex max-w-[520px] items-center gap-1 rounded-[28px] border border-[var(--ui-hairline)] p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
        style={{ background: "color-mix(in srgb, var(--dx-surface) 82%, transparent)" }}
      >
        {TABS.map(({ key, label, color, Icon }) => {
          const isActive = key === active;
          return (
            <li key={key} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onSelect(key)}
                aria-current={isActive ? "page" : undefined}
                className="flex h-[58px] w-full flex-col items-center justify-center gap-[3px] rounded-[22px] active:scale-[0.94]"
                style={{
                  color: isActive ? color : "var(--ui-secondary)",
                  background: isActive ? `color-mix(in srgb, ${color} 16%, transparent)` : "transparent",
                  transition: "background-color 220ms ease, color 220ms ease, transform 120ms ease",
                }}
              >
                <Icon active={isActive} color={color} />
                <span
                  className={`max-w-full truncate text-[11px] leading-none ${isActive ? "font-bold" : "font-medium"}`}
                  // Yellow text is hard to read on light backgrounds, so deepen it a little.
                  style={isActive && key === "notes" ? { color: "color-mix(in srgb, #ffd60a 70%, var(--dx-heading))" } : undefined}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
