import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import AppIcon from "./components/AppIcon";
import TabBar, { type TabKey } from "./components/TabBar";
import BackupSection from "./components/BackupSection";
import MobileToday from "./pages/MobileToday";
import Tasks from "./pages/Tasks";
import MobileCalendar from "./pages/MobileCalendar";
import Notes from "./pages/Notes";
import { getThemePreference, setThemePreference, type ThemePreference } from "./theme";
import { IS_ANDROID } from "./lib/platform";
import { getDeveloperProfile, updateDeveloperProfile, type DeveloperProfile } from "./services/api";
import "./pages/calendar.css";

type Tab = TabKey;
const TAB_KEYS: Tab[] = ["today", "tasks", "calendar", "notes", "more"];

const TAB_KEY = "devtrack.mobile-tab";

function readTab(): Tab {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (TAB_KEYS.includes(saved as Tab)) return saved as Tab;
  } catch {
    // ignore
  }
  return "today";
}

function NameRow() {
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"" | "saved" | "error">("");

  useEffect(() => {
    let cancelled = false;
    getDeveloperProfile()
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setName(p.display_name);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!profile) return;
    const next = name.trim();
    if (next === profile.display_name) return;
    try {
      const saved = await updateDeveloperProfile({ ...profile, display_name: next });
      setProfile(saved);
      setName(saved.display_name);
      setStatus("saved");
      setTimeout(() => setStatus(""), 1800);
    } catch {
      setStatus("error");
    }
  }

  return (
    <label className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
      <span className="shrink-0 text-[15px]">Your name</span>
      <span className="flex min-w-0 items-center gap-2">
        {status === "saved" && <span className="text-[12px] text-[#30d158]">Saved</span>}
        {status === "error" && <span className="text-[12px] text-[var(--dx-danger)]">Couldn’t save</span>}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="Add your name"
          maxLength={60}
          autoComplete="given-name"
          enterKeyHint="done"
          disabled={!profile}
          className="min-w-0 bg-transparent text-right text-[15px] text-[var(--ui-secondary)] outline-none placeholder:text-[var(--ui-tertiary)] focus:text-[var(--dx-heading)]"
        />
      </span>
    </label>
  );
}

function More() {
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference());
  const [version, setVersion] = useState("");

  useEffect(() => {
    if (IS_ANDROID) getVersion().then(setVersion).catch(() => undefined);
  }, []);

  function choose(value: ThemePreference) {
    setTheme(value);
    setThemePreference(value);
  }

  return (
    <div className="cal space-y-6">
      <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em]">More</h1>

      <section className="ui-card divide-y divide-[var(--ui-hairline)]">
        <NameRow />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-[15px]">Appearance</span>
          <div className="cal-segmented" role="group" aria-label="Appearance">
            {(["system", "light", "dark"] as ThemePreference[]).map((value) => (
              <button key={value} type="button" aria-pressed={theme === value} onClick={() => choose(value)}>
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <BackupSection />

      <section className="ui-card p-5 text-center">
        <AppIcon size={56} className="mx-auto drop-shadow-[0_6px_14px_rgba(0,0,0,0.25)]" />
        <p className="mt-3 text-[17px] font-semibold">DevTrack</p>
        <p className="mt-0.5 text-[13px] text-[var(--ui-secondary)]">{version ? `Version ${version}` : "Phone preview"}</p>
        <p className="mx-auto mt-3 max-w-[280px] text-[13px] leading-relaxed text-[var(--ui-secondary)]">
          Your tasks, calendar and notes are stored only on this phone. Nothing is sent anywhere.
        </p>
      </section>
    </div>
  );
}

export default function MobileApp() {
  const [tab, setTab] = useState<Tab>(readTab);

  function open(next: Tab) {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--dx-heading)]">
      <main
        className="mx-auto w-full max-w-[640px] px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 16px)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 116px)",
        }}
      >
        {tab === "today" && <MobileToday onOpen={open} />}
        {tab === "tasks" && (
          <>
            <h1 className="mb-4 text-[30px] font-bold leading-tight tracking-[-0.03em]">Tasks</h1>
            <Tasks />
          </>
        )}
        {tab === "calendar" && <MobileCalendar />}
        {tab === "notes" && <Notes />}
        {tab === "more" && <More />}
      </main>

      <TabBar active={tab} onSelect={open} />
    </div>
  );
}
