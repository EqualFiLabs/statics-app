#!/usr/bin/env node

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const localDirectory = resolve(siteRoot, ".local");
const sessionPath = resolve(localDirectory, "connected-session.json");
const evidencePath = resolve(localDirectory, "connected-verification.json");

try {
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  const statusResult = spawnSync(
    process.execPath,
    [resolve(siteRoot, "scripts/local-control.mjs"), "status"],
    { cwd: siteRoot, encoding: "utf8" }
  );
  if (statusResult.status !== 0) {
    throw new Error(statusResult.stderr.trim() || "The connected fixture status check failed.");
  }
  const status = JSON.parse(statusResult.stdout);
  const playwright = spawnSync(
    "npx",
    [
      "playwright",
      "test",
      "test/e2e/connected-local.spec.ts",
      "--config",
      "playwright.connected.config.ts",
    ],
    {
      cwd: siteRoot,
      stdio: "inherit",
      env: { ...process.env, CONNECTED_DAPP_URL: session.appUrl },
    }
  );
  if (playwright.status !== 0) {
    throw new Error(`Connected browser verification exited with code ${playwright.status}.`);
  }
  mkdirSync(localDirectory, { recursive: true, mode: 0o700 });
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        appUrl: session.appUrl,
        chainId: status.chainId,
        blockNumber: status.blockNumber,
        protocolCommit: status.protocolCommit,
        fixtureBasketIds: status.fixtureBasketIds,
        routeGate: "passed",
        privyIdentityProof: "not-executed",
        externalWalletLifecycle: "not-executed",
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
  chmodSync(evidencePath, 0o600);
  process.stdout.write(`Wrote truthful local browser evidence to ${evidencePath}.\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
