
import type { ReactNode } from "react";

export type Page =
  | "overview"
  | "activity"
  | "checkins"
  | "reports"
  | "settings";

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

type IconName =
  | "overview"
  | "activity"
  | "checkins"
  | "reports"
  | "settings"
  | "close"
  | "arrow";

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const paths: Record<IconName, ReactNode> = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    activity: (
      <>
        <path d="M3 12h4l3-7 4 14 3-7h4" />
      </>
    ),
    checkins: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    reports: (
      <>
        <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v6h5M9 13h6M9 17h6" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" />
        <circle cx="15" cy="17" r="2" />
      </>
    ),
    close: <path d="M5 5l14 14M19 5 5 19" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const primaryNav: {
  id: Page;
  label: string;
  icon: IconName;
  description: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    icon: "overview",
    description: "Your workspace",
  },
  {
    id: "activity",
    label: "Activity",
    icon: "activity",
    description: "Tracked sessions",
  },
  {
    id: "checkins",
    label: "Check-ins",
    icon: "checkins",
    description: "Work journal",
  },
  {
    id: "reports",
    label: "Reports",
    icon: "reports",
    description: "Daily summaries",
  },
];

export default function Sidebar({
  activePage,
  onNavigate,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  function navigate(page: Page) {
    onNavigate(page);
    onCloseMobile?.();
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/65 lg:hidden"
          aria-label="Close navigation"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col",
          "border-r border-[#26282b] bg-[#151617]",
          "transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:shrink-0",
        ].join(" ")}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-[#26282b] px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#41474b] bg-[#222729]">
              <span className="font-mono text-[15px] font-semibold tracking-tighter text-[#d6e7dc]">
                D/
              </span>
            </div>

            <div>
              <p className="text-[15px] font-semibold tracking-[-0.035em] text-[#f2f2f0]">
                DevTracker
              </p>
              <p className="mt-0.5 text-[10px] tracking-[0.02em] text-[#777d80]">
                Developer work journal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-md p-2 text-[#929699] hover:bg-[#242729] lg:hidden"
            aria-label="Close navigation"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-6">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#686e70]">
            Workspace
          </p>

          <nav className="space-y-1" aria-label="Main navigation">
            {primaryNav.map((item) => {
              const active = activePage === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "group relative flex w-full items-center gap-3",
                    "rounded-md px-3 py-[11px] text-left transition-colors",
                    active
                      ? "bg-[#272d2c] text-[#f1f3f0]"
                      : "text-[#92989a] hover:bg-[#1f2223] hover:text-[#e5e7e5]",
                  ].join(" ")}
                >
                  {active && (
                    <span className="absolute bottom-2 left-0 top-2 w-[2px] rounded-r bg-[#a1c4b2]" />
                  )}

                  <span className={active ? "text-[#b5d2c2]" : "text-[#767d7e]"}>
                    <Icon name={item.icon} size={17} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{item.label}</p>
                    <p
                      className={[
                        "mt-0.5 text-[10px]",
                        active ? "text-[#899d93]" : "text-[#5f6667]",
                      ].join(" ")}
                    >
                      {item.description}
                    </p>
                  </div>

                  {active && (
                    <span className="text-[#81978c]">
                      <Icon name="arrow" size={14} />
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="my-6 border-t border-[#272a2b]" />

          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#686e70]">
            Preferences
          </p>

          <button
            type="button"
            onClick={() => navigate("settings")}
            aria-current={activePage === "settings" ? "page" : undefined}
            className={[
              "flex w-full items-center gap-3 rounded-md px-3 py-3",
              "text-left text-[13px] transition-colors",
              activePage === "settings"
                ? "bg-[#272d2c] text-[#f1f3f0]"
                : "text-[#92989a] hover:bg-[#1f2223] hover:text-white",
            ].join(" ")}
          >
            <Icon name="settings" size={17} />
            Settings & Privacy
          </button>
        </div>

        <div className="border-t border-[#26282b] p-4">
          <div className="flex items-center gap-3 rounded-lg border border-[#2b3030] bg-[#1a1e1e] px-3 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#26342e]">
              <span className="h-2 w-2 rounded-full bg-[#9ac9ad]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-[#e2e7e2]">
                Local workspace
              </p>
              <p className="mt-0.5 text-[10px] text-[#848e89]">
                Private by default
              </p>
            </div>
          </div>

          <p className="mt-4 px-1 font-mono text-[10px] text-[#585f60]">
            DEVTRACKER / PERSONAL BETA
          </p>
        </div>
      </aside>
    </>
  );
}
