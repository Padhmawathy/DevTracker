import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { initializeTheme } from "./theme";
import App from "./App.tsx";
import "./devtrack_light_contrast_patch.css";
import {
  getTrackerSettings,
  updateTrackerSettings,
  type TrackerSettings,
} from "./services/api";
import "./page-theme.css";
// Apply the saved appearance before rendering the interface.
initializeTheme();
const DISMISSED_KEY = "devtrack.consent-declined.v1";

type Screen = "loading" | "welcome" | "app" | "error";

function DevTrackStartup() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const current = await getTrackerSettings();
        if (cancelled) return;
        setSettings(current);
        setMessage("");
        setScreen(
          current.tracking_consent_granted ||
            localStorage.getItem(DISMISSED_KEY) === "yes"
            ? "app"
            : "welcome"
        );
      } catch {
        if (cancelled) return;
        if (attempt < 8) {
          retry = setTimeout(() => setAttempt((value) => value + 1), 1000);
        } else {
          setMessage("DevTrack could not connect to its local backend.");
          setScreen("error");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [attempt]);

  async function enableTracking() {
    if (!settings || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const saved = await updateTrackerSettings({
        ...settings,
        tracking_consent_granted: true,
        tracking_enabled: true,
      });
      setSettings(saved);
      localStorage.removeItem(DISMISSED_KEY);
      setScreen("app");
    } catch {
      setMessage("Couldn't save your consent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function declineTracking() {
    localStorage.setItem(DISMISSED_KEY, "yes");
    setScreen("app");
  }

  if (screen === "app") return <App />;

  if (screen === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#151819] text-[#dbe3dd]">
        Starting DevTrack...
      </main>
    );
  }

  if (screen === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#151819] p-8 text-[#e5ebe6]">
        <h1 className="text-xl font-semibold">DevTrack couldn't start</h1>
        <p role="alert" className="text-sm text-[#f1aaa5]">{message}</p>
        <button
          type="button"
          className="rounded-md bg-[#a7c9b4] px-5 py-2 text-[#17231b]"
          onClick={() => { setMessage(""); setAttempt(0); setScreen("loading"); }}
        >
          Retry connection
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#151819] px-5 py-10 text-[#e5ebe6]">
      <section className="w-full max-w-xl space-y-5 rounded-xl border border-[#39413d] bg-[#1c1f20] p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#a7c9b4]">Privacy and control</p>
        <h1 className="text-3xl font-semibold">Welcome to DevTrack</h1>
        <p className="text-sm leading-6 text-[#b6c0b9]">
          DevTrack can record which applications you use and how long you use them.
          If window-title collection is enabled in Settings, it can also record active
          window titles, which may contain sensitive information.
        </p>
        <p className="text-sm leading-6 text-[#b6c0b9]">
          Activity information is stored locally on this computer. Tracking stays off
          until you explicitly grant permission. You can pause tracking or withdraw
          consent in Settings at any time. Declining will not prevent you from using
          the rest of DevTrack.
        </p>
        {message && <p role="alert" className="text-sm text-[#f1aaa5]">{message}</p>}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void enableTracking()}
            className="rounded-md bg-[#a7c9b4] px-5 py-3 font-semibold text-[#17231b] disabled:opacity-50"
          >
            {busy ? "Saving..." : "Enable Tracking"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={declineTracking}
            className="rounded-md border border-[#546159] px-5 py-3 disabled:opacity-50"
          >
            Not Now
          </button>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DevTrackStartup />
  </StrictMode>
);
