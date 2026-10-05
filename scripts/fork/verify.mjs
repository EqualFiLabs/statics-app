import { resolve } from "node:path";
import { callSession } from "./launcher.mjs";
import { verifyState } from "./verify-state.mjs";
import { appRoot, childEnvironment, save, urls } from "./profile.mjs";
import { run } from "./processes.mjs";

export async function browserChecks(profile, path) {
  const children = new Set();
  await run(
    process.execPath,
    [
      resolve(appRoot, "node_modules/@playwright/test/cli.js"),
      "test",
      "--config",
      "playwright.genesis-fork.config.ts",
      "test/e2e/phase-one-fork.spec.ts",
      "--output",
      resolve(path, "browser-results"),
    ],
    {
      cwd: appRoot,
      env: { ...childEnvironment(), CONNECTED_DAPP_URL: urls(profile).app },
      log: resolve(path, "browser.log"),
      children,
    }
  );
}
export async function verifyFork(profile, path) {
  const status = await callSession(profile, "status");
  if (!Object.values(status.health).every(Boolean))
    throw new Error("Session is unhealthy; verification did not mutate it.");
  const state = await verifyState(profile, path);
  await browserChecks(profile, path);
  const report = {
    state,
    browserChecks: 3,
    mutations: 0,
    manualChecks: ["Privy authentication and wallet signing remain a separate manual check."],
  };
  save(resolve(path, "verification.json"), report);
  console.log(JSON.stringify(report, null, 2));
  return report;
}
