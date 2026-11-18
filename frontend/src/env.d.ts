/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set by the Tauri CLI during `tauri build` / `tauri android build`. */
  readonly TAURI_ENV_PLATFORM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
