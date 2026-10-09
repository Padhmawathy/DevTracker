
import {
  LayoutDashboard,
  Clock3,
  ClipboardList,
  FileText,
  Settings,
  Activity,
} from "lucide-react";

export type Page =
  | "overview"
  | "activity"
  | "checkins"
  | "reports"
  | "settings";

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "activity", label: "Activity Timeline", icon: Clock3 },
  { id: "checkins", label: "Check-ins", icon: ClipboardList },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export default function Sidebar({
  activePage,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="w-full border-b border-slate-800 bg-slate-900 p-5 md:min-h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-lg bg-indigo-600 p-2">
          <Activity size={22} />
        </div>

        <div>
          <h1 className="text-xl font-bold">
            DevTracker
          </h1>
          <p className="text-xs text-slate-400">
            Developer Work Journal
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 md:flex-col">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          const available =
            item.id === "overview" || item.id === "activity";

          return (
            <button
              key={item.id}
              type="button"
              disabled={!available}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800"
              } ${
                !available
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <p className="mt-10 border-t border-slate-800 pt-5 text-xs text-slate-500">
        DevTracker v0.5 — Frontend Preview
      </p>
    </aside>
  );
}
