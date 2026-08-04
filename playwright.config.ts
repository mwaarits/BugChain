import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:4173" },
  webServer: { command: "npm run build --workspace frontend && npm run preview --workspace frontend -- --host 127.0.0.1 --port 4173", port: 4173, reuseExistingServer: true },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } }]
});
