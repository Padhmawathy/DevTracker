

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

const fieldClass = "w-full appearance-none rounded-xl border border-[#373d3c] bg-[#17191a] px-4 py-3.5 pr-10 text-[13px] font-medium text-[#e7eae6] outline-none transition-colors hover:border-[#59635e] focus:border-[#a7c9b4] focus:ring-2 focus:ring-[#a7c9b4]/10 disabled:cursor-not-allowed disabled:opacity-40";

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
      <label htmlFor={id} className="block text-[12px] font-medium text-[#b8c0ba]">{label}</label>
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
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a7c9b4]">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {help && <p className="text-[11px] leading-relaxed text-[#858e8b]">{help}</p>}
    </div>
  );
}

function FocusGoalSlider({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const safeValue = Math.min(720, Math.max(30, value));
  const progress = ((safeValue - 30) / (720 - 30)) * 100;
  return (
    <section className="overflow-hidden rounded-2xl border border-[#303536] bg-gradient-to-br from-[#202425] via-[#1d2021] to-[#1b1e1f] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.16)] sm:p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#3b4842] bg-[#29332e]">
          <Target size={20} className="text-[#b8ddc5]" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-[#f0f2ee]">Daily focus goal</h3>
          <p className="mt-0.5 text-[11px] text-[#929c95]">Set the time you want to focus each day</p>
        </div>
      </div>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-[#f0f2ee] sm:text-[26px] font-semibold tracking-tight">{durationLabel(safeValue * 60)}</span>
        <span className="text-[12px] text-[#929c95]">per day</span>
      </div>
      <label htmlFor="profile-focus-goal" className="sr-only">Daily focus goal between 30 minutes and 12 hours</label>
      <input id="profile-focus-goal" type="range" min={30} max={720} step={30} value={safeValue}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ background: `linear-gradient(90deg, #a7c9b4 0%, #a7c9b4 ${progress}%, #343b38 ${progress}%, #343b38 100%)` }}
        className="mt-7 h-2.5 w-full cursor-pointer appearance-none rounded-full accent-[#b8d9c4]"
      />
      <div className="mt-3 flex justify-between text-[11px] text-[#929c95]">
        <span>30 minutes</span><span>12 hours</span>
      </div>
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#343c38] bg-[#1a1e1c]/70 px-3.5 py-3 text-[12px] leading-relaxed text-[#b8c0ba]">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-[#9fc9a9]" />
        <span>Your daily tracking target is <strong className="font-semibold text-[#f0f2ee]">{durationLabel(safeValue * 60)}</strong>. Save your profile to apply it.</span>
      </div>
    </section>
  );
}

export default function Settings() {

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

    return <p className="text-[#929c95]">Loading settings...</p>;

  }



  if (!settings) {

    return (

      <p role="alert" className="text-[#f1aaa5]">

        {error || "Tracker settings are unavailable."}

      </p>

    );

  }



  return (

    <div className="max-w-5xl space-y-7">



        <form

          onSubmit={handleProfileSave}

          className="overflow-hidden rounded-2xl border border-[#2b2f30] bg-[#1c1f20] shadow-[0_12px_35px_rgba(0,0,0,0.12)]"

        >

          <div className="flex items-center gap-3 border-b border-[#2b2f30] px-5 py-5 sm:px-6">

            <UserRound size={19} className="text-[#a7c9b4]" />



            <div>

              <h2 className="text-[14px] font-semibold text-[#f0f2ee]">

                Developer Profile

              </h2>

              <p className="mt-1 text-[11px] text-[#858e8b]">

                Personalize your work journal and future insights.

              </p>

            </div>

          </div>



          <div className="space-y-5 p-5">

            {profileLoading ? (

              <p className="text-sm text-[#929c95]">

                Loading developer profile...

              </p>

            ) : profile ? (

              <>

                <div className="grid gap-5 sm:grid-cols-2">

                  <div>

                    <label

                      htmlFor="profile-name"

                      className="mb-2 block text-[12px] text-[#b8c0ba]"

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

                      className="w-full rounded-md border border-[#373d3c] bg-[#17191a] px-3 py-2.5 text-[13px] text-[#e7eae6] outline-none focus:border-[#a7c9b4]"

                    />

                  </div>



                  <div>

                    <label

                      htmlFor="profile-role"

                      className="mb-2 block text-[12px] text-[#b8c0ba]"

                    >

                      Developer role

                    </label>

                    <select

                      id="profile-role"

                      value={profile.role}

                      onChange={(event) =>

                        updateProfileField("role", event.target.value)

                      }

                      className="w-full rounded-md border border-[#373d3c] bg-[#17191a] px-3 py-2.5 text-[13px] text-[#e7eae6] outline-none focus:border-[#a7c9b4]"

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

                      className="mb-2 block text-[12px] text-[#b8c0ba]"

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

                      className="w-full rounded-md border border-[#373d3c] bg-[#17191a] px-3 py-2.5 text-[13px] text-[#e7eae6] outline-none focus:border-[#a7c9b4]"

                    />

                  </div>



                  <div>

                    <label

                      htmlFor="profile-editor"

                      className="mb-2 block text-[12px] text-[#b8c0ba]"

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

                      className="w-full rounded-md border border-[#373d3c] bg-[#17191a] px-3 py-2.5 text-[13px] text-[#e7eae6] outline-none focus:border-[#a7c9b4]"

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

                  className="flex items-center gap-2 rounded-md bg-[#a7c9b4] px-5 py-2.5 text-sm font-semibold text-[#17231b] hover:bg-[#bdd9c7] disabled:opacity-50"

                >

                  <Save size={17} />

                  {profileSaving ? "Saving..." : "Save Profile"}

                </button>

              </>

            ) : (

              <p className="text-sm text-[#f1aaa5]">

                Developer profile is unavailable.

              </p>

            )}



            {profileSuccess && (

              <p role="status" className="text-sm text-[#a7c9b4]">

                {profileSuccess}

              </p>

            )}



            {profileError && (

              <p role="alert" className="text-sm text-[#f1aaa5]">

                {profileError}

              </p>

            )}

          </div>

        </form>



        <ApplicationCategories />



        <form onSubmit={handleSave} className="space-y-6">

          <section className="space-y-6 rounded-2xl border border-[#2b2f30] bg-[#1c1f20] p-5 shadow-[0_12px_35px_rgba(0,0,0,0.12)] sm:p-6">

            <h2 className="flex items-center gap-2 text-sm font-semibold">

              <SlidersHorizontal size={20} />

              Activity tracking

            </h2>



            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium">Enable activity tracking</span>
                <span className="block text-sm text-[#929c95]">
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
                className="h-4 w-4 accent-[#a7c9b4]"
              />
            </label>

            <div className="rounded-lg border border-[#39413d] p-4">
              <p className="text-sm text-[#c3ccc5]">
                Consent status: {settings.tracking_consent_granted ? "Granted" : "Not granted"}
              </p>
              <p className="mt-2 text-xs text-[#929c95]">
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
                  className="mt-3 rounded-md border border-[#6b4848] px-3 py-2 text-sm text-[#f1aaa5]"
                >
                  Withdraw tracking consent
                </button>
              )}
              <p className="mt-2 text-xs text-[#929c95]">
                Save settings to apply your changes.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-[#39413d] bg-[#17231b] px-4 py-3">
              <Clock3 size={18} className="mt-0.5 shrink-0 text-[#a7c9b4]" />
              <p className="text-[12px] leading-relaxed text-[#b8c0ba]">Choose how precisely DevTrack records app changes, and when inactive time should stop counting.</p>
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



          <section className="space-y-6 rounded-2xl border border-[#2b2f30] bg-[#1c1f20] p-5 shadow-[0_12px_35px_rgba(0,0,0,0.12)] sm:p-6">

            <h2 className="flex items-center gap-2 text-sm font-semibold">

              <Shield size={20} />

              Privacy & control

            </h2>



            <label className="flex items-center justify-between gap-4">

              <span>

                <span className="block font-medium">

                  Collect window titles

                </span>

                <span className="block text-sm text-[#929c95]">

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

                className="h-4 w-4 accent-[#a7c9b4]"

              />

            </label>



            <p className="text-xs text-[#738078]">

              Changing this option does not remove titles already stored

              in your database.

            </p>

          </section>





          <section className="overflow-hidden rounded-2xl border border-[#2b2f30] bg-[#1c1f20] shadow-[0_12px_35px_rgba(0,0,0,0.12)]">

            <div className="flex items-center gap-3 border-b border-[#2b2f30] px-5 py-5 sm:px-6">

              <Bell size={18} className="text-[#a7c9b4]" />

              <div>

                <h2 className="text-[14px] font-semibold text-[#f0f2ee]">

                  Smart check-in reminders

                </h2>

                <p className="mt-1 text-[11px] text-[#858e8b]">

                  Set a comfortable rhythm for recording your progress.

                </p>

              </div>

            </div>



            <div className="space-y-6 p-5 sm:p-6">

              <label className="flex items-center justify-between gap-4">

                <span>

                  <span className="block text-[13px] font-medium text-[#e1e5e0]">

                    Enable reminders

                  </span>

                  <span className="mt-1 block text-[11px] text-[#858e8b]">

                    Allow DevTracker to send check-in reminders.

                  </span>

                </span>



                <input

                  type="checkbox"

                  checked={settings.reminders_enabled}

                  onChange={(event) =>

                    updateField("reminders_enabled", event.target.checked)

                  }

                  className="h-4 w-4 accent-[#a7c9b4]"

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

                    className="mb-2 block text-[12px] text-[#b8c0ba]"

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

                    className="w-full rounded-md border border-[#373d3c] bg-[#17191a] px-3 py-2.5 text-[13px] text-[#e7eae6] outline-none focus:border-[#a7c9b4]"

                  />

                </div>



                <div>

                  <label

                    htmlFor="reminder-work-end"

                    className="mb-2 block text-[12px] text-[#b8c0ba]"

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

                    className="w-full rounded-md border border-[#373d3c] bg-[#17191a] px-3 py-2.5 text-[13px] text-[#e7eae6] outline-none focus:border-[#a7c9b4]"

                  />

                </div>

              </div>



              <label className="flex items-center justify-between gap-4 border-t border-[#2b2f30] pt-5">

                <span>

                  <span className="block text-[13px] font-medium text-[#e1e5e0]">

                    Respect idle time

                  </span>

                  <span className="mt-1 block text-[11px] text-[#858e8b]">

                    Avoid sending reminders while the computer is idle.

                  </span>

                </span>



                <input

                  type="checkbox"

                  checked={settings.reminders_respect_idle}

                  onChange={(event) =>

                    updateField("reminders_respect_idle", event.target.checked)

                  }

                  className="h-4 w-4 accent-[#a7c9b4]"

                />

              </label>

            </div>

          </section>





          <button

            type="submit"

            disabled={saving}

            className="flex items-center gap-2 rounded-md bg-[#a7c9b4] px-5 py-2.5 text-sm font-semibold text-[#17231b] hover:bg-[#bdd9c7] disabled:opacity-50"

          >

            <Save size={18} />

            {saving ? "Saving..." : "Save Settings"}

          </button>



          {success && (

            <p role="status" className="text-sm text-[#a7c9b4]">

              {success}

            </p>

          )}



          {error && (

            <p role="alert" className="text-sm text-[#f1aaa5]">

              {error}

            </p>

          )}

        </form>

    </div>

  );

}
