/**
 * Where DevTrack is running.
 *
 * TAURI_ENV_PLATFORM is set by the Tauri CLI while it builds the frontend
 * ("windows", "android", ...). In development, open the app with `?mobile`
 * to preview the phone version in a normal browser.
 */
export const IS_ANDROID = import.meta.env.TAURI_ENV_PLATFORM === "android";

const PREVIEW_FLAG = "devtrack.mobile-preview";

function previewRequested(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("mobile")) sessionStorage.setItem(PREVIEW_FLAG, "1");
    if (params.has("desktop")) sessionStorage.removeItem(PREVIEW_FLAG);
    return sessionStorage.getItem(PREVIEW_FLAG) === "1";
  } catch {
    return false;
  }
}

/** True on the phone app (and in the browser phone preview). */
export const IS_MOBILE = IS_ANDROID || previewRequested();
