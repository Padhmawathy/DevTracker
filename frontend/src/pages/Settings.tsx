import { useEffect, useState, type ReactNode } from "react";

import ApplicationCategories from "../components/ApplicationCategories";
import "./calendar.css";
import {
  getDeveloperProfile,
  getTrackerSettings,
  updateDeveloperProfile,
  updateTrackerSettings,
  type DeveloperProfile,
  type TrackerSettings,
} from "../services/api";
import { getThemePreference, setThemePreference, type ThemePreference } from "../theme";

// Presentation-only duration choices. Persisted API units remain unchanged.
function durationLabel(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hr`);
  if (minutes) parts.push(`${minutes} min`);
  if (seconds || !parts.length) parts.push(`${seconds} sec`);
  return parts.join(" ");
}

const ROLES: { value: string; label: string }[] = [
  { value: "frontend", label: "Frontend Developer" },
  { value: "backend", label: "Backend Developer" },
  { value: "fullstack", label: "Full-stack Developer" },
  { value: "mobile", label: "Mobile Developer" },
  { value: "devops", label: "DevOps Engineer" },
  { value: "qa", label: "QA Engineer" },
  { value: "data", label: "Data Developer" },
  { value: "other", label: "Other" },
];

const FOCUS_GOALS = Array.from({ length: 24 }, (_, i) => (i + 1) * 30); // 30 min – 12 hr

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const inlineInput =
  "min-w-0 flex-1 bg-transparent text-right text-[14px] text-[var(--ui-secondary)] outline-none placeholder:text-[var(--ui-tertiary)] focus:text-[var(--dx-heading)] disabled:opacity-40";

/* ---------------- building blocks ---------------- */

function Group({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <section>
      {title && (
        <h2 className="mb-1.5 px-4 text-[13px] font-medium text-[var(--ui-secondary)]">{title}</h2>
      )}
      <div className="ui-card divide-y divide-[var(--ui-hairline)] overflow-hidden !p-0">{children}</div>
      {footer && (
        <p className="mt-1.5 px-4 text-[12px] leading-relaxed text-[var(--ui-tertiary)]">{footer}</p>
      )}
    </section>
  );
}

function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[48px] items-center gap-4 px-4 py-2">
      <label htmlFor={htmlFor} className="shrink-0 text-[14px] text-[var(--dx-heading)]">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{children}</div>
    </div>
  );
}

function Toggle({
  id, label, checked, onChange, disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Row label={label} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="ui-switch"
      />
    </Row>
  );
}

function Choice({
  id, label, value, options, format, onChange, disabled,
}: {
  id: string;
  label: string;
  value: number | string;
  options: (number | string)[];
  format: (value: number | string) => string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  // Keep a saved value that is not in the preset list selectable.
  const choices = options.includes(value) ? options : [...options, value];
  return (
    <Row label={label} htmlFor={id}>
      <div className="relative flex items-center">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="cursor-pointer appearance-none bg-transparent pr-5 text-right text-[14px] text-[var(--ui-secondary)] outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {format(choice)}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`pointer-events-none absolute right-0 h-3.5 w-3.5 text-[var(--ui-tertiary)] ${disabled ? "opacity-40" : ""}`}
        >
          <path d="m8 10 4-4 4 4M8 14l4 4 4-4" />
        </svg>
      </div>
    </Row>
  );
}

/* ---------------- page ---------------- */

export default function Settings() {
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);

  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<TrackerSettings | null>(null);
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);
  const [savedProfile, setSavedProfile] = useState<DeveloperProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [settingsResult, profileResult] = await Promise.allSettled([
        getTrackerSettings(),
        getDeveloperProfile(),
      ]);
      if (cancelled) return;
      if (settingsResult.status === "fulfilled") {
        setSettings(settingsResult.value);
        setSavedSettings(settingsResult.value);
      } else {
        setError("Unable to load settings.");
      }
      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
        setSavedProfile(profileResult.value);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const settingsDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const profileDirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const dirty = settingsDirty || profileDirty;

  function changeTheme(next: ThemePreference) {
    setTheme(next);
    setThemePreference(next);
  }

  function setField<K extends keyof TrackerSettings>(key: K, value: TrackerSettings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    setSavedNote(false);
  }

  function setProfileField<K extends keyof DeveloperProfile>(key: K, value: DeveloperProfile[K]) {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
    setSavedNote(false);
  }

  function setTracking(enabled: boolean) {
    if (!settings) return;
    if (enabled && !settings.tracking_consent_granted) {
      const approved = window.confirm(
        "Turn on activity tracking?\n\n" +
          "DevTrack records application names, how long you use them and, " +
          "if you allow it, window titles. Everything stays on this computer, " +
          "and you can turn it off at any time."
      );
      if (!approved) return;
      setSettings({ ...settings, tracking_enabled: true, tracking_consent_granted: true });
      setSavedNote(false);
      return;
    }
    setField("tracking_enabled", enabled);
  }

  function withdrawConsent() {
    if (!settings) return;
    setSettings({ ...settings, tracking_enabled: false, tracking_consent_granted: false });
    setSavedNote(false);
  }

  function discard() {
    setSettings(savedSettings);
    setProfile(savedProfile);
    setError("");
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setError("");
    try {
      if (settingsDirty && settings) {
        const result = await updateTrackerSettings(settings);
        setSettings(result);
        setSavedSettings(result);
      }
      if (profileDirty && profile) {
        const result = await updateDeveloperProfile(profile);
        setProfile(result);
        setSavedProfile(result);
      }
      setSavedNote(true);
    } catch {
      setError("Couldn’t save. Check the values and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-[14px] text-[var(--ui-secondary)]">Loading…</p>;
  }

  if (!settings) {
    return (
      <p role="alert" className="text-[14px] text-[var(--dx-danger)]">
        {error || "Settings are unavailable."}
      </p>
    );
  }

  const trackingOn = settings.tracking_enabled && settings.tracking_consent_granted;
  const remindersOff = !settings.reminders_enabled;

  return (
    <div className="cal mx-auto max-w-[680px] space-y-7 pb-24">
      {profile && (
        <Group title="Profile">
          <Row label="Name" htmlFor="profile-name">
            <input
              id="profile-name"
              value={profile.display_name}
              maxLength={80}
              placeholder="Your name"
              onChange={(e) => setProfileField("display_name", e.target.value)}
              className={inlineInput}
            />
          </Row>
          <Choice
            id="profile-role"
            label="Role"
            value={profile.role}
            options={ROLES.map((r) => r.value)}
            format={(v) => ROLES.find((r) => r.value === v)?.label ?? String(v)}
            onChange={(v) => setProfileField("role", v)}
          />
          <Row label="Language" htmlFor="profile-language">
            <input
              id="profile-language"
              value={profile.primary_language}
              maxLength={80}
              placeholder="Python, TypeScript…"
              onChange={(e) => setProfileField("primary_language", e.target.value)}
              className={inlineInput}
            />
          </Row>
          <Row label="Editor" htmlFor="profile-editor">
            <input
              id="profile-editor"
              value={profile.primary_editor}
              maxLength={80}
              placeholder="VS Code…"
              onChange={(e) => setProfileField("primary_editor", e.target.value)}
              className={inlineInput}
            />
          </Row>
          <Choice
            id="profile-focus-goal"
            label="Daily focus goal"
            value={profile.daily_focus_goal_minutes}
            options={FOCUS_GOALS}
            format={(v) => durationLabel(Number(v) * 60)}
            onChange={(v) => setProfileField("daily_focus_goal_minutes", Number(v))}
          />
        </Group>
      )}

      <Group title="Appearance">
        <div className="px-4 py-3">
          <div className="cal-segmented" role="group" aria-label="Appearance">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={theme === t.value}
                onClick={() => changeTheme(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Group>

      <Group
        title="Tracking"
        footer="Activity is stored only on this computer. Turning off window titles doesn’t remove titles already saved."
      >
        <Toggle id="tracking-enabled" label="Track activity" checked={trackingOn} onChange={setTracking} />
        <Toggle
          id="collect-titles"
          label="Record window titles"
          checked={settings.collect_window_titles}
          onChange={(v) => setField("collect_window_titles", v)}
        />
        <Choice
          id="idle-threshold"
          label="Pause when idle for"
          value={settings.idle_threshold}
          options={[30, 60, 120, 180, 300, 600, 900, 1200, 1800, 3600]}
          format={(v) => durationLabel(Number(v))}
          onChange={(v) => setField("idle_threshold", Number(v))}
        />
        {settings.tracking_consent_granted && (
          <div className="px-4 py-3">
            <button type="button" onClick={withdrawConsent} className="text-[14px] text-[var(--dx-danger)]">
              Withdraw tracking consent
            </button>
          </div>
        )}
      </Group>

      <Group title="Check-in reminders">
        <Toggle
          id="reminders-enabled"
          label="Remind me to check in"
          checked={settings.reminders_enabled}
          onChange={(v) => setField("reminders_enabled", v)}
        />
        <Choice
          id="reminder-interval"
          label="Every"
          value={settings.reminder_interval_minutes}
          options={[15, 20, 30, 45, 60, 90, 120, 180, 240]}
          format={(v) => durationLabel(Number(v) * 60)}
          onChange={(v) => setField("reminder_interval_minutes", Number(v))}
          disabled={remindersOff}
        />
        <Row label="Working hours" htmlFor="reminder-work-start">
          <input
            id="reminder-work-start"
            type="time"
            required
            aria-label="Working hours start"
            value={settings.reminder_work_start}
            disabled={remindersOff}
            onChange={(e) => setField("reminder_work_start", e.target.value)}
            className="bg-transparent text-right text-[14px] text-[var(--ui-secondary)] outline-none disabled:opacity-40"
          />
          <span className="text-[var(--ui-tertiary)]">–</span>
          <input
            id="reminder-work-end"
            type="time"
            required
            aria-label="Working hours end"
            value={settings.reminder_work_end}
            disabled={remindersOff}
            onChange={(e) => setField("reminder_work_end", e.target.value)}
            className="bg-transparent text-right text-[14px] text-[var(--ui-secondary)] outline-none disabled:opacity-40"
          />
        </Row>
      </Group>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 text-[13px] font-medium text-[var(--ui-secondary)] hover:text-[var(--dx-heading)] [&::-webkit-details-marker]:hidden">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3 transition-transform group-open:rotate-90"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
          Advanced
        </summary>

        <div className="mt-3 space-y-7">
          <Group footer="Fine-tune how precisely activity is recorded. The defaults suit most people.">
            <Choice
              id="poll-interval"
              label="Check the active app every"
              value={settings.poll_interval}
              options={[1, 2, 3, 5, 10, 15, 30, 60]}
              format={(v) => durationLabel(Number(v))}
              onChange={(v) => setField("poll_interval", Number(v))}
            />
            <Choice
              id="min-duration"
              label="Ignore visits shorter than"
              value={settings.min_activity_duration}
              options={[1, 2, 3, 5, 10, 15, 30, 60]}
              format={(v) => durationLabel(Number(v))}
              onChange={(v) => setField("min_activity_duration", Number(v))}
            />
            <Choice
              id="reminder-snooze"
              label="Snooze reminders for"
              value={settings.reminder_snooze_minutes}
              options={[5, 10, 15, 20, 30, 45, 60]}
              format={(v) => durationLabel(Number(v) * 60)}
              onChange={(v) => setField("reminder_snooze_minutes", Number(v))}
              disabled={remindersOff}
            />
            <Toggle
              id="respect-idle"
              label="No reminders while idle"
              checked={settings.reminders_respect_idle}
              onChange={(v) => setField("reminders_respect_idle", v)}
              disabled={remindersOff}
            />
          </Group>

          <ApplicationCategories />
        </div>
      </details>

      {/* Save bar: only appears when something changed */}
      {(dirty || savedNote || error) && (
        <div className="sticky bottom-4 z-10">
          <div className="ui-card flex items-center gap-3 !py-2.5 !pl-4 !pr-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
            <p
              role={error ? "alert" : "status"}
              className={`min-w-0 flex-1 truncate text-[13px] ${error ? "text-[var(--dx-danger)]" : "text-[var(--ui-secondary)]"}`}
            >
              {error || (dirty ? "You have unsaved changes." : "Saved.")}
            </p>
            {dirty && (
              <>
                <button type="button" onClick={discard} disabled={saving} className="ui-btn px-4 py-1.5 text-[13px]">
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="ui-btn-primary px-4 py-1.5 text-[13px]"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
