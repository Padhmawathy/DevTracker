import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { initializeTheme } from "./theme";
import App from "./App.tsx";
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
      <main className="flex min-h-screen items-center justify-center bg-[var(--ui-page)] text-[13px] text-[var(--ui-secondary)]">
        <span className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--ui-fill-strong)] border-t-[var(--dx-accent)]" />
          Starting DevTrack…
        </span>
      </main>
    );
  }

  if (screen === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--ui-page)] p-8 text-center text-[var(--dx-heading)]">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">DevTrack couldn’t start</h1>
        <p role="alert" className="max-w-sm text-[14px] text-[var(--ui-secondary)]">{message}</p>
        <button
          type="button"
          className="ui-btn-primary mt-3 h-9 px-5"
          onClick={() => { setMessage(""); setAttempt(0); setScreen("loading"); }}
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ui-page)] px-5 py-10 text-[var(--dx-heading)]">
      <section className="ui-card w-full max-w-[480px] p-8 text-center sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[14px] bg-gradient-to-b from-[#3b9cff] to-[#0062d1] text-[22px] font-semibold text-white shadow-[0_6px_16px_rgba(0,113,227,0.35)]">
          D
        </div>
        <h1 className="mt-6 text-[28px] font-bold tracking-[-0.025em]">Welcome to DevTrack</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--ui-secondary)]">
          DevTrack can record which apps you use and for how long. If window-title
          collection is turned on in Settings, it can also record window titles,
          which may contain sensitive information.
        </p>
        <div className="mt-6 space-y-3 rounded-[12px] bg-[var(--ui-fill)] p-4 text-left text-[13px] leading-relaxed text-[var(--dx-body)]">
          <p><span className="font-semibold text-[var(--dx-heading)]">Stays on this computer.</span> Activity is stored locally.</p>
          <p><span className="font-semibold text-[var(--dx-heading)]">Off until you allow it.</span> Pause tracking or withdraw consent in Settings at any time.</p>
          <p><span className="font-semibold text-[var(--dx-heading)]">Optional.</span> Declining doesn’t stop you using the rest of DevTrack.</p>
        </div>
        {message && <p role="alert" className="mt-4 text-[13px] text-[var(--dx-danger)]">{message}</p>}
        <div className="mt-7 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void enableTracking()}
            className="ui-btn-primary h-11 w-full text-[15px]"
          >
            {busy ? "Saving…" : "Enable Tracking"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={declineTracking}
            className="h-11 w-full rounded-full text-[15px] font-medium text-[var(--dx-accent-text)] hover:bg-[var(--ui-fill)] disabled:opacity-40"
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
