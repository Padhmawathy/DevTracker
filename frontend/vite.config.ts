
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Lets the app know it is being built for Android (TAURI_ENV_PLATFORM).
  envPrefix: ["VITE_", "TAURI_ENV_"],
  server: {
    proxy: {
      "/api": {
        // DEVTRACK_PORT (or a full DEVTRACK_API URL) lets a dev backend
        // run beside the installed app.
        target:
          process.env.DEVTRACK_API ??
          `http://127.0.0.1:${process.env.DEVTRACK_PORT ?? "8000"}`,
        changeOrigin: true,
      },
    },
  },
});
