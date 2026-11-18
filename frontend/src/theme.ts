export type ThemePreference = "dark" | "light" | "system";

const STORAGE_KEY = "devtrack.theme";

export function getThemePreference(): ThemePreference {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved === "dark" || saved === "light" || saved === "system") {
    return saved;
  }

  return "dark";
}

export function applyTheme(preference: ThemePreference): void {
  const resolved =
    preference === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;

  document.documentElement.dataset.theme = resolved;
}

export function setThemePreference(preference: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, preference);
  applyTheme(preference);
}

export function initializeTheme(): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  const handleSystemChange = () => {
    if (getThemePreference() === "system") {
      applyTheme("system");
    }
  };

  applyTheme(getThemePreference());
  media.addEventListener("change", handleSystemChange);

  return () => {
    media.removeEventListener("change", handleSystemChange);
  };
}