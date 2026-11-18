import { useEffect, useRef } from "react";

export type Page =
  | "overview"
  | "tasks"
  | "activity"
  | "checkins"
  | "calendar"
  | "reports"
  | "settings";

interface TopNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const TABS: { id: Page; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "checkins", label: "Check-ins" },
  { id: "calendar", label: "Calendar" },
  { id: "reports", label: "Reports" },
];

function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

export default function TopNav({ activePage, onNavigate }: TopNavProps) {
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  // On narrow screens the tab strip scrolls; keep the current tab in view.
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "smooth",
    });
  }, [activePage]);

  const settingsActive = activePage === "settings";

  return (
    <header className="sticky top-0 z-40 shrink-0 bg-[var(--ui-toolbar)] shadow-[inset_0_-0.5px_0_var(--ui-hairline)] backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-8 md:h-[60px] md:flex-nowrap md:py-0">
        {/* Brand */}
        <button
          type="button"
          onClick={() => onNavigate("overview")}
          className="flex items-center gap-2.5 rounded-[8px] md:w-[180px]"
          aria-label="DevTrack home"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-b from-[#47a1ff] to-[#0a6cf0] text-[13px] font-semibold text-white shadow-[0_2px_6px_rgba(0,113,227,0.35)]">
            D
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--dx-heading)]">
            DevTrack
          </span>
        </button>

        {/* Settings sits top-right; on small screens it shares the first row with the brand */}
        <button
          type="button"
          onClick={() => onNavigate("settings")}
          aria-label="Settings"
          aria-current={settingsActive ? "page" : undefined}
          title="Settings"
          className={[
            "ml-auto flex h-8 w-8 items-center justify-center rounded-full transition-colors md:order-last md:ml-0",
            settingsActive
              ? "bg-[var(--dx-accent-soft)] text-[var(--dx-accent-text)]"
              : "text-[var(--ui-secondary)] hover:bg-[var(--ui-fill)] hover:text-[var(--dx-heading)]",
          ].join(" ")}
        >
          <GearIcon />
        </button>

        {/* Segmented page switcher */}
        <nav
          aria-label="Main navigation"
          className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex md:w-auto md:flex-1 md:justify-center md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <ul className="inline-flex gap-0.5 rounded-full bg-[var(--ui-fill-strong)] p-[3px]">
            {TABS.map((tab) => {
              const active = activePage === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    ref={active ? activeTabRef : undefined}
                    type="button"
                    onClick={() => onNavigate(tab.id)}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "h-[30px] whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-all duration-200",
                      active
                        ? "bg-[var(--dx-surface)] text-[var(--dx-heading)] shadow-[0_0_0_0.5px_var(--ui-hairline),0_1px_3px_rgba(0,0,0,0.12)]"
                        : "text-[var(--ui-secondary)] hover:text-[var(--dx-heading)]",
                    ].join(" ")}
                  >
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Balances the brand column so the switcher stays centred on desktop */}
        <span className="hidden md:block md:w-[132px]" aria-hidden="true" />
      </div>
    </header>
  );
}
