
import { useEffect, useState, type FormEvent } from "react";
import {
  Bell,
  Save,
  Shield,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";

import {
  getTrackerSettings,
  updateTrackerSettings,
  type TrackerSettings,
  getDeveloperProfile,
  updateDeveloperProfile,
  type DeveloperProfile,
} from "../services/api";

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
    <div className="max-w-4xl space-y-6">
      
        <form
          onSubmit={handleProfileSave}
          className="overflow-hidden rounded-lg border border-[#2b2f30] bg-[#1c1f20]"
        >
          <div className="flex items-center gap-3 border-b border-[#2b2f30] px-5 py-4">
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

                <div>
                  <label
                    htmlFor="profile-focus-goal"
                    className="mb-2 block text-[12px] text-[#b8c0ba]"
                  >
                    Daily focus goal (minutes)
                  </label>
                  <input
                    id="profile-focus-goal"
                    type="number"
                    min={30}
                    max={720}
                    step={1}
                    required
                    value={profile.daily_focus_goal_minutes}
                    onChange={(event) =>
                      updateProfileField(
                        "daily_focus_goal_minutes",
                        Number(event.target.value)
                      )
                    }
                    className="w-full max-w-[300px] rounded-md border border-[#373d3c] bg-[#17191a] px-3 py-2.5 text-[13px] text-[#e7eae6] outline-none focus:border-[#a7c9b4]"
                  />
                  <p className="mt-2 text-[11px] text-[#858e8b]">
                    Set a personal target between 30 minutes and 12 hours.
                  </p>
                </div>

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

      <form onSubmit={handleSave} className="space-y-6">
        <section className="space-y-5 rounded-lg border border-[#2b2f30] bg-[#1c1f20] p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal size={20} />
            Tracking Preferences
          </h2>

          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium">
                Enable activity tracking
              </span>
              <span className="block text-sm text-[#929c95]">
                Allow the running collector to record activity.
              </span>
            </span>

            <input
              type="checkbox"
              checked={settings.tracking_enabled}
              onChange={(event) =>
                updateField("tracking_enabled", event.target.checked)
              }
              className="h-4 w-4 accent-[#a7c9b4]"
            />
          </label>

          <div>
            <label
              htmlFor="poll-interval"
              className="mb-2 block text-sm text-[#c3ccc5]"
            >
              Polling interval (1–60 seconds)
            </label>
            <input
              id="poll-interval"
              type="number"
              min={1}
              max={60}
              step={1}
              required
              value={settings.poll_interval}
              onChange={(event) =>
                updateField("poll_interval", Number(event.target.value))
              }
              className="w-full max-w-[300px] rounded-md border border-[#39413d] bg-[#17191a] px-3 py-2.5 text-[#f0f2ee] focus:border-[#a7c9b4] outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="idle-threshold"
              className="mb-2 block text-sm text-[#c3ccc5]"
            >
              Idle threshold (30–3600 seconds)
            </label>
            <input
              id="idle-threshold"
              type="number"
              min={30}
              max={3600}
              step={1}
              required
              value={settings.idle_threshold}
              onChange={(event) =>
                updateField("idle_threshold", Number(event.target.value))
              }
              className="w-full max-w-[300px] rounded-md border border-[#39413d] bg-[#17191a] px-3 py-2.5 text-[#f0f2ee] focus:border-[#a7c9b4] outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="min-duration"
              className="mb-2 block text-sm text-[#c3ccc5]"
            >
              Minimum activity duration (1–60 seconds)
            </label>
            <input
              id="min-duration"
              type="number"
              min={1}
              max={60}
              step={1}
              required
              value={settings.min_activity_duration}
              onChange={(event) =>
                updateField(
                  "min_activity_duration",
                  Number(event.target.value)
                )
              }
              className="w-full max-w-[300px] rounded-md border border-[#39413d] bg-[#17191a] px-3 py-2.5 text-[#f0f2ee] focus:border-[#a7c9b4] outline-none"
            />
          </div>
        </section>

        <section className="space-y-5 rounded-lg border border-[#2b2f30] bg-[#1c1f20] p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Shield size={20} />
            Privacy
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

                
        <section className="overflow-hidden rounded-lg border border-[#2b2f30] bg-[#1c1f20]">
          <div className="flex items-center gap-3 border-b border-[#2b2f30] px-5 py-4">
            <Bell size={18} className="text-[#a7c9b4]" />
            <div>
              <h2 className="text-[14px] font-semibold text-[#f0f2ee]">
                Smart Check-in Reminders
              </h2>
              <p className="mt-1 text-[11px] text-[#858e8b]">
                Choose when DevTracker should remind you to document your work.
              </p>
            </div>
          </div>

          <div className="space-y-6 p-5">
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
              <div>
                <label
                  htmlFor="reminder-interval"
                  className="mb-2 block text-[12px] text-[#b8c0ba]"
                >
                  Reminder interval (minutes)
                </label>
                <input
                  id="reminder-interval"
                  type="number"
                  min={15}
                  max={240}
                  step={1}
                  required
                  disabled={!settings.reminders_enabled}
                  value={settings.reminder_interval_minutes}
                  onChange={(event) =>
                    updateField(
                      "reminder_interval_minutes",
                      Number(event.target.value)
                    )
                  }
                  className="w-full rounded-md border border-[#373d3c] bg-[#17191a] px-3 py-2.5 text-[13px] text-[#e7eae6] outline-none focus:border-[#a7c9b4] disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="reminder-snooze"
                  className="mb-2 block text-[12px] text-[#b8c0ba]"
                >
                  Snooze duration (minutes)
                </label>
                <input
                  id="reminder-snooze"
                  type="number"
                  min={5}
                  max={60}
                  step={1}
                  required
                  disabled={!settings.reminders_enabled}
                  value={settings.reminder_snooze_minutes}
                  onChange={(event) =>
                    updateField(
                      "reminder_snooze_minutes",
                      Number(event.target.value)
                    )
                  }
                  className="w-full rounded-md border border-[#373d3c] bg-[#17191a] px-3 py-2.5 text-[13px] text-[#e7eae6] outline-none focus:border-[#a7c9b4] disabled:opacity-50"
                />
              </div>

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
