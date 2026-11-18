

import { useEffect, useState, type FormEvent } from "react";

import ApplicationCategories from "../components/ApplicationCategories";

import {

  Bell,

  Save,

  Shield,

  SlidersHorizontal,

  UserRound,
  Target,
  Clock3,
  Sparkles,

} from "lucide-react";



import {

  getTrackerSettings,

  updateTrackerSettings,

  type TrackerSettings,

  getDeveloperProfile,

  updateDeveloperProfile,

  type DeveloperProfile,

} from "../services/api";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from "../theme";


// Presentation-only duration choices. Persisted API units remain unchanged.
function durationLabel(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (seconds || !parts.length) parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  return parts.join(" ");
}

const fieldClass = "w-full appearance-none rounded-xl border border-[var(--dx-border-strong)] bg-[var(--dx-input)] px-4 py-3.5 pr-10 text-[13px] font-medium text-[var(--dx-heading)] outline-none transition-colors hover:border-[var(--dx-accent)] focus:border-[var(--dx-accent)] focus:ring-2 focus:ring-[var(--dx-accent-soft)] disabled:cursor-not-allowed disabled:opacity-40";

function DurationSelect({
  id, label, value, options, unit, onChange, disabled, help,
}: {
  id: string;
  label: string;
  value: number;
  options: number[];
  unit: "seconds" | "minutes";
  onChange: (value: number) => void;
  disabled?: boolean;
  help?: string;
}) {
  const choices = options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[12px] font-medium text-[var(--dx-body)]">{label}</label>
      <div className="relative">
        <select id={id} value={value} onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled} className={fieldClass}>
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {durationLabel(unit === "minutes" ? choice * 60 : choice)}
              {!options.includes(choice) ? " (saved custom value)" : ""}
            </option>
          ))}
        </select>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dx-accent-text)]">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {help && <p className="text-[11px] leading-relaxed text-[var(--dx-muted)]">{help}</p>}
    </div>
  );
}

function FocusGoalSlider({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const safeValue = Math.min(720, Math.max(30, value));
  const progress = ((safeValue - 30) / (720 - 30)) * 100;
  return (
    <section className="ui-card overflow-hidden p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--dx-accent-soft)] text-[var(--dx-accent-text)]">
          <Target size={20} className="text-[var(--dx-accent-text)]" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--dx-heading)]">Daily focus goal</h3>
          <p className="mt-0.5 text-[11px] text-[var(--dx-muted)]">Set the time you want to focus each day</p>
        </div>
      </div>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-[var(--dx-heading)] sm:text-[26px] font-semibold tracking-tight">{durationLabel(safeValue * 60)}</span>
        <span className="text-[12px] text-[var(--dx-muted)]">per day</span>
      </div>
      <label htmlFor="profile-focus-goal" className="sr-only">Daily focus goal between 30 minutes and 12 hours</label>
      <input id="profile-focus-goal" type="range" min={30} max={720} step={30} value={safeValue}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ background: `linear-gradient(90deg, var(--dx-accent) 0%, var(--dx-accent) ${progress}%, var(--dx-track) ${progress}%, var(--dx-track) 100%)` }}
        className="mt-7 h-2.5 w-full cursor-pointer appearance-none rounded-full accent-[var(--dx-accent)]"
      />
      <div className="mt-3 flex justify-between text-[11px] text-[var(--dx-muted)]">
        <span>30 minutes</span><span>12 hours</span>
      </div>
      <div className="mt-5 flex items-start gap-2 rounded-[12px] bg-[var(--ui-fill)] px-3.5 py-3 text-[12px] leading-relaxed text-[var(--dx-body)]">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-[var(--dx-accent-text)]" />
        <span>Your daily tracking target is <strong className="font-semibold text-[var(--dx-heading)]">{durationLabel(safeValue * 60)}</strong>. Save your profile to apply it.</span>
      </div>
    </section>
  );
}

export default function Settings() {

  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);

  function changeTheme(nextTheme: ThemePreference) {
    setTheme(nextTheme);
    setThemePreference(nextTheme);
  }

  const [settings, setSettings] = useState<TrackerSettings | null>(null);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");



  const [profile, setProfile] = useState<DeveloperProfile | null>(null);

  const [profileLoading, setProfileLoading] = useState(true);

  const [profileSaving, setProfileSaving] = useState(false);

  const [profileError, setProfileError] = useState("");

  const [profileSuccess, setProfileSuccess] = useState("");





  useEffect(() => {

    let cancelled = false;



    async function loadSettings() {

      try {

        const result = await getTrackerSettings();



        if (!cancelled) {

          setSettings(result);

        }

      } catch {

        if (!cancelled) {

          setError("Unable to load tracker settings.");

        }

      } finally {

        if (!cancelled) {

          setLoading(false);

        }

      }

    }



    void loadSettings();



    return () => {

      cancelled = true;

    };

  }, []);







  useEffect(() => {

    let cancelled = false;



    async function loadProfile() {

      try {

        const result = await getDeveloperProfile();



        if (!cancelled) {

          setProfile(result);

          setProfileError("");

        }

      } catch {

        if (!cancelled) {

          setProfileError("Unable to load developer profile.");

        }

      } finally {

        if (!cancelled) {

          setProfileLoading(false);

        }

      }

    }



    void loadProfile();



    return () => {

      cancelled = true;

    };

  }, []);





  function updateField<K extends keyof TrackerSettings>(

    key: K,

    value: TrackerSettings[K]

  ) {

    setSettings((current) =>

      current ? { ...current, [key]: value } : current

    );

    setSuccess("");

  }



  async function handleSave(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!settings) return;



    setSaving(true);

    setError("");

    setSuccess("");



    try {

      const saved = await updateTrackerSettings(settings);

      setSettings(saved);

      setSuccess("Settings saved successfully.");

    } catch {

      setError("Unable to save settings. Check the values and try again.");

    } finally {

      setSaving(false);

    }

  }





  function updateProfileField<K extends keyof DeveloperProfile>(

    key: K,

    value: DeveloperProfile[K]

  ) {

    setProfile((current) =>

      current ? { ...current, [key]: value } : current

    );



    setProfileSuccess("");

  }



  async function handleProfileSave(

    event: FormEvent<HTMLFormElement>

  ) {

    event.preventDefault();



    if (!profile || profileSaving) return;



    setProfileSaving(true);

    setProfileError("");

    setProfileSuccess("");



    try {

      const saved = await updateDeveloperProfile(profile);



      setProfile(saved);

      setProfileSuccess("Developer profile saved successfully.");

    } catch {

      setProfileError(

        "Unable to save profile. Check the entered values."

      );

    } finally {

      setProfileSaving(false);

    }

  }





  if (loading) {

    return <p className="text-[var(--dx-muted)]">Loading settings...</p>;

  }



  if (!settings) {

    return (

      <p role="alert" className="text-[var(--dx-danger)]">

        {error || "Tracker settings are unavailable."}

      </p>

    );

  }



  return (

    <div className="max-w-5xl space-y-5">

      <section className="ui-card overflow-hidden">
        <div className="border-b border-[var(--dx-border)] px-5 py-4 sm:px-6">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--dx-heading)]">
            Appearance
          </h2>
          <p className="mt-1 text-[11px] text-[var(--dx-muted)]">
            Choose how DevTrack looks on your device.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 p-5 sm:p-6">
          {([
            { value: "dark", label: "Dark", Icon: Moon },
            { value: "light", label: "Light", Icon: Sun },
            { value: "system", label: "System", Icon: Monitor },
          ] as const).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => changeTheme(value)}
              aria-pressed={theme === value}
              className={`flex flex-col items-center gap-2 rounded-[12px] px-3 py-4 text-[13px] font-medium transition ${
                theme === value
                  ? "bg-[var(--dx-accent-soft)] text-[var(--dx-accent-text)] shadow-[inset_0_0_0_2px_var(--dx-accent)]"
                  : "bg-[var(--ui-fill)] text-[var(--dx-body)] hover:bg-[var(--ui-fill-strong)]"
              }`}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </div>
      </section>

        <form

          onSubmit={handleProfileSave}

          className="ui-card overflow-hidden"

        >

          <div className="flex items-center gap-3 border-b border-[var(--dx-border)] px-5 py-5 sm:px-6">

            <UserRound size={19} className="text-[var(--dx-accent-text)]" />



            <div>

              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--dx-heading)]">

                Developer Profile

              </h2>

              <p className="mt-1 text-[11px] text-[var(--dx-muted)]">

                Personalize your work journal and future insights.

              </p>

            </div>

          </div>



          <div className="space-y-5 p-5">

            {profileLoading ? (

              <p className="text-sm text-[var(--dx-muted)]">

                Loading developer profile...

              </p>

            ) : profile ? (

              <>

                <div className="grid gap-5 sm:grid-cols-2">

                  <div>

                    <label

                      htmlFor="profile-name"

                      className="mb-2 block text-[12px] text-[var(--dx-body)]"

                    >

                      Display name

                    </label>

                    <input

                      id="profile-name"

                      type="text"

                      maxLength={80}

                      value={profile.display_name}

                      onChange={(event) =>

                        updateProfileField(

                          "display_name",

                          event.target.value

                        )

                      }

                      placeholder="Your name"

                      className="ui-input"

                    />

                  </div>



                  <div>

                    <label

                      htmlFor="profile-role"

                      className="mb-2 block text-[12px] text-[var(--dx-body)]"

                    >

                      Developer role

                    </label>

                    <select

                      id="profile-role"

                      value={profile.role}

                      onChange={(event) =>

                        updateProfileField("role", event.target.value)

                      }

                      className="ui-input"

                    >

                      <option value="frontend">Frontend Developer</option>

                      <option value="backend">Backend Developer</option>

                      <option value="fullstack">Full-stack Developer</option>

                      <option value="mobile">Mobile Developer</option>

                      <option value="devops">DevOps Engineer</option>

                      <option value="qa">QA Engineer</option>

                      <option value="data">Data Developer</option>

                      <option value="other">Other</option>

                    </select>

                  </div>



                  <div>

                    <label

                      htmlFor="profile-language"

                      className="mb-2 block text-[12px] text-[var(--dx-body)]"

                    >

                      Primary programming language

                    </label>

                    <input

                      id="profile-language"

                      type="text"

                      maxLength={80}

                      value={profile.primary_language}

                      onChange={(event) =>

                        updateProfileField(

                          "primary_language",

                          event.target.value

                        )

                      }

                      placeholder="Python, TypeScript, Java..."

                      className="ui-input"

                    />

                  </div>



                  <div>

                    <label

                      htmlFor="profile-editor"

                      className="mb-2 block text-[12px] text-[var(--dx-body)]"

                    >

                      Primary editor / IDE

                    </label>

                    <input

                      id="profile-editor"

                      type="text"

                      maxLength={80}

                      value={profile.primary_editor}

                      onChange={(event) =>

                        updateProfileField(

                          "primary_editor",

                          event.target.value

                        )

                      }

                      placeholder="VS Code, IntelliJ..."

                      className="ui-input"

                    />

                  </div>

                </div>



                <FocusGoalSlider
                  value={profile.daily_focus_goal_minutes}
                  onChange={(value) => updateProfileField("daily_focus_goal_minutes", value)}
                />



                <button

                  type="submit"

                  disabled={profileSaving}

                  className="ui-btn-primary flex items-center gap-2 px-5 py-2.5"

                >

                  <Save size={17} />

                  {profileSaving ? "Saving..." : "Save Profile"}

                </button>

              </>

            ) : (

              <p className="text-sm text-[var(--dx-danger)]">

                Developer profile is unavailable.

              </p>

            )}



            {profileSuccess && (

              <p role="status" className="text-sm text-[var(--dx-accent-text)]">

                {profileSuccess}

              </p>

            )}



            {profileError && (

              <p role="alert" className="text-sm text-[var(--dx-danger)]">

                {profileError}

              </p>

            )}

          </div>

        </form>



        <ApplicationCategories />



        <form onSubmit={handleSave} className="space-y-6">

          <section className="ui-card space-y-6 p-5 sm:p-6">

            <h2 className="flex items-center gap-2 text-sm font-semibold">

              <SlidersHorizontal size={20} />

              Activity tracking

            </h2>



            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium">Enable activity tracking</span>
                <span className="block text-sm text-[var(--dx-muted)]">
                  Allow the running collector to record activity.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.tracking_enabled && settings.tracking_consent_granted}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  if (enabled && !settings.tracking_consent_granted) {
                    const approved = window.confirm(
                      "Enable DevTrack activity tracking?\n\n" +
                      "DevTrack records application names, usage duration, " +
                      "and optionally active window titles.\n\n" +
                      "Your tracking data is stored locally on this computer. " +
                      "You can disable tracking or withdraw consent later.\n\n" +
                      "Select OK to grant permission."
                    );
                    if (!approved) return;
                    setSettings((current) => current ? {
                      ...current,
                      tracking_enabled: true,
                      tracking_consent_granted: true,
                    } : current);
                    setSuccess("");
                  } else {
                    updateField("tracking_enabled", enabled);
                  }
                }}
                className="ui-switch"
              />
            </label>

            <div className="rounded-[12px] bg-[var(--ui-fill)] p-4">
              <p className="text-sm text-[var(--dx-body)]">
                Consent status: {settings.tracking_consent_granted ? "Granted" : "Not granted"}
              </p>
              <p className="mt-2 text-xs text-[var(--dx-muted)]">
                DevTrack records application usage and, when enabled, active window titles.
                Tracking data is stored locally. You can withdraw permission at any time.
              </p>
              {settings.tracking_consent_granted && (
                <button
                  type="button"
                  onClick={() => {
                    setSettings((current) => current ? {
                      ...current,
                      tracking_consent_granted: false,
                      tracking_enabled: false,
                    } : current);
                    setSuccess("");
                  }}
                  className="mt-3 rounded-[10px] bg-[var(--ui-fill)] px-3 py-2 text-sm text-[var(--dx-danger)]"
                >
                  Withdraw tracking consent
                </button>
              )}
              <p className="mt-2 text-xs text-[var(--dx-muted)]">
                Save settings to apply your changes.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-[12px] bg-[var(--dx-accent-soft)] px-4 py-3">
              <Clock3 size={18} className="mt-0.5 shrink-0 text-[var(--dx-accent-text)]" />
              <p className="text-[12px] leading-relaxed text-[var(--dx-body)]">Choose how precisely DevTrack records app changes, and when inactive time should stop counting.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
            <DurationSelect
              id="poll-interval"
              label="Check active application every"
              value={settings.poll_interval}
              unit="seconds"
              options={[1, 2, 3, 5, 10, 15, 30, 60]}
              onChange={(value) => updateField("poll_interval", value)}
              help="Shorter intervals capture app switches more precisely."
            />



            <DurationSelect
              id="idle-threshold"
              label="Mark me idle after"
              value={settings.idle_threshold}
              unit="seconds"
              options={[30, 60, 120, 180, 300, 600, 900, 1200, 1800, 3600]}
              onChange={(value) => updateField("idle_threshold", value)}
              help="Stop tracking active work after this much inactivity."
            />



            <DurationSelect
              id="min-duration"
              label="Ignore app visits shorter than"
              value={settings.min_activity_duration}
              unit="seconds"
              options={[1, 2, 3, 5, 10, 15, 30, 60]}
              onChange={(value) => updateField("min_activity_duration", value)}
              help="Reduces noise from very brief app switches."
            />
            </div>

          </section>



          <section className="ui-card space-y-6 p-5 sm:p-6">

            <h2 className="flex items-center gap-2 text-sm font-semibold">

              <Shield size={20} />

              Privacy & control

            </h2>



            <label className="flex items-center justify-between gap-4">

              <span>

                <span className="block font-medium">

                  Collect window titles

                </span>

                <span className="block text-sm text-[var(--dx-muted)]">

                  When disabled, new activity records contain application

                  names without window titles.

                </span>

              </span>



              <input

                type="checkbox"

                checked={settings.collect_window_titles}

                onChange={(event) =>

                  updateField(

                    "collect_window_titles",

                    event.target.checked

                  )

                }

                className="ui-switch"

              />

            </label>



            <p className="text-xs text-[var(--dx-muted)]">

              Changing this option does not remove titles already stored

              in your database.

            </p>

          </section>





          <section className="ui-card overflow-hidden">

            <div className="flex items-center gap-3 border-b border-[var(--dx-border)] px-5 py-5 sm:px-6">

              <Bell size={18} className="text-[var(--dx-accent-text)]" />

              <div>

                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--dx-heading)]">

                  Smart check-in reminders

                </h2>

                <p className="mt-1 text-[11px] text-[var(--dx-muted)]">

                  Set a comfortable rhythm for recording your progress.

                </p>

              </div>

            </div>



            <div className="space-y-6 p-5 sm:p-6">

              <label className="flex items-center justify-between gap-4">

                <span>

                  <span className="block text-[13px] font-medium text-[var(--dx-heading)]">

                    Enable reminders

                  </span>

                  <span className="mt-1 block text-[11px] text-[var(--dx-muted)]">

                    Allow DevTracker to send check-in reminders.

                  </span>

                </span>



                <input

                  type="checkbox"

                  checked={settings.reminders_enabled}

                  onChange={(event) =>

                    updateField("reminders_enabled", event.target.checked)

                  }

                  className="ui-switch"

                />

              </label>



              <div className="grid gap-5 sm:grid-cols-2">

                <DurationSelect
                    id="reminder-interval"
                    label="Remind me every"
                    value={settings.reminder_interval_minutes}
                    unit="minutes"
                    options={[15, 20, 30, 45, 60, 90, 120, 180, 240]}
                    onChange={(value) => updateField("reminder_interval_minutes", value)}
                    disabled={!settings.reminders_enabled}
                  />



                <DurationSelect
                    id="reminder-snooze"
                    label="Snooze reminders for"
                    value={settings.reminder_snooze_minutes}
                    unit="minutes"
                    options={[5, 10, 15, 20, 30, 45, 60]}
                    onChange={(value) => updateField("reminder_snooze_minutes", value)}
                    disabled={!settings.reminders_enabled}
                  />



                <div>

                  <label

                    htmlFor="reminder-work-start"

                    className="mb-2 block text-[12px] text-[var(--dx-body)]"

                  >

                    Working hours start

                  </label>

                  <input

                    id="reminder-work-start"

                    type="time"

                    required

                    value={settings.reminder_work_start}

                    onChange={(event) =>

                      updateField("reminder_work_start", event.target.value)

                    }

                    className="ui-input"

                  />

                </div>



                <div>

                  <label

                    htmlFor="reminder-work-end"

                    className="mb-2 block text-[12px] text-[var(--dx-body)]"

                  >

                    Working hours end

                  </label>

                  <input

                    id="reminder-work-end"

                    type="time"

                    required

                    value={settings.reminder_work_end}

                    onChange={(event) =>

                      updateField("reminder_work_end", event.target.value)

                    }

                    className="ui-input"

                  />

                </div>

              </div>



              <label className="flex items-center justify-between gap-4 border-t border-[var(--dx-border)] pt-5">

                <span>

                  <span className="block text-[13px] font-medium text-[var(--dx-heading)]">

                    Respect idle time

                  </span>

                  <span className="mt-1 block text-[11px] text-[var(--dx-muted)]">

                    Avoid sending reminders while the computer is idle.

                  </span>

                </span>



                <input

                  type="checkbox"

                  checked={settings.reminders_respect_idle}

                  onChange={(event) =>

                    updateField("reminders_respect_idle", event.target.checked)

                  }

                  className="ui-switch"

                />

              </label>

            </div>

          </section>





          <button

            type="submit"

            disabled={saving}

            className="ui-btn-primary flex items-center gap-2 px-5 py-2.5"

          >

            <Save size={18} />

            {saving ? "Saving..." : "Save Settings"}

          </button>



          {success && (

            <p role="status" className="text-sm text-[var(--dx-accent-text)]">

              {success}

            </p>

          )}



          {error && (

            <p role="alert" className="text-sm text-[var(--dx-danger)]">

              {error}

            </p>

          )}

        </form>

    </div>

  );

}
