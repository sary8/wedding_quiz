import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // ホスト（PC）
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    // 参加者（スマホ）
    {
      name: "mobile",
      use: { ...devices["iPhone SE"] },
    },
  ],

  // バックエンドは別途起動が必要（npm run dev in src/backend）
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 10000,
  },
});
