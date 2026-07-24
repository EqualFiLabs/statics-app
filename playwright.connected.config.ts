import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.CONNECTED_DAPP_URL;
if (!baseURL) throw new Error("CONNECTED_DAPP_URL is required for connected local verification.");

export default defineConfig({
  testDir: "./test/e2e",
  outputDir: "./test-results/connected",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  timeout: 120_000,
  use: {
    baseURL,
    channel: "chrome",
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "connected-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
  ],
});
