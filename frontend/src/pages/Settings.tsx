
import { useEffect, useState, type FormEvent } from "react";
import { Save, Shield, SlidersHorizontal } from "lucide-react";
import {
  getTrackerSettings,
  updateTrackerSettings,
  type TrackerSettings,
} from "../services/api";

export default function Settings() {
  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  if (loading) {
    return <p className="text-slate-400">Loading settings...</p>;
  }

  if (!settings) {
    return (
      <p role="alert" className="text-red-400">
        {error || "Tracker settings are unavailable."}
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <p className="text-sm text-indigo-400">
          Developer Workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          Settings & Privacy
        </h1>
        <p className="mt-2 text-slate-400">
          Configure how DevTracker records your application activity.
        </p>
      </header>

      <form onSubmit={handleSave} className="space-y-6">
        <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <SlidersHorizontal size={20} />
            Tracking Preferences
          </h2>

          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium">
                Enable activity tracking
              </span>
              <span className="block text-sm text-slate-400">
                Allow the running collector to record activity.
              </span>
            </span>

            <input
              type="checkbox"
              checked={settings.tracking_enabled}
              onChange={(event) =>
                updateField("tracking_enabled", event.target.checked)
              }
              className="h-5 w-5 accent-indigo-600"
            />
          </label>

          <div>
            <label
              htmlFor="poll-interval"
              className="mb-2 block text-sm text-slate-300"
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
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
            />
          </div>

          <div>
            <label
              htmlFor="idle-threshold"
              className="mb-2 block text-sm text-slate-300"
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
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
            />
          </div>

          <div>
            <label
              htmlFor="min-duration"
              className="mb-2 block text-sm text-slate-300"
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
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
            />
          </div>
        </section>

        <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Shield size={20} />
            Privacy
          </h2>

          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium">
                Collect window titles
              </span>
              <span className="block text-sm text-slate-400">
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
              className="h-5 w-5 accent-indigo-600"
            />
          </label>

          <p className="text-xs text-slate-500">
            Changing this option does not remove titles already stored
            in your database.
          </p>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? "Saving..." : "Save Settings"}
        </button>

        {success && (
          <p role="status" className="text-sm text-green-400">
            {success}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
