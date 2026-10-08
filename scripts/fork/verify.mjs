import { resolve } from "node:path";
import { callSession } from "./launcher.mjs";
import { verifyState } from "./verify-state.mjs";
import { applicationRoot, childEnvironment, save, urls } from "./profile.mjs";
import { run } from "./processes.mjs";
import { transactionContext } from "./deploy.mjs";
import { verifyFixture } from "./market-fixture.mjs";
import { json } from "./profile.mjs";
import { createPublicClient, http } from "viem";

export async function browserChecks(profile, path, children = new Set()) {
  const appRoot = applicationRoot(profile);
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
  const marketFixture = await verifyFixture(
    transactionContext(profile).client,
    json(resolve(path, "cleanup-launch-manifest.json")),
    profile,
    createPublicClient({ transport: http(profile.historyRpcUrl) }),
    profile.pool.creationTransactionHash
      ? json(resolve(path, "receipts", `${profile.pool.creationTransactionHash}.json`))
      : undefined
  );
  await browserChecks(profile, path);
  const report = {
    state,
    marketFixture,
    browserChecks: 3,
    mutations: 0,
    manualChecks: ["Privy authentication and wallet signing remain a separate manual check."],
  };
  save(resolve(path, "verification.json"), report);
  console.log(JSON.stringify(report, null, 2));
  return report;
}
