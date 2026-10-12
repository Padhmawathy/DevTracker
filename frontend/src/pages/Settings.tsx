
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
