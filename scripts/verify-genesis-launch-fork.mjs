#!/usr/bin/env node

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const localDirectory = resolve(siteRoot, ".local/launch-fork");
const sessionPath = resolve(localDirectory, "session.json");
const evidencePath = resolve(localDirectory, "genesis-verification.json");

try {
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  const statusResult = spawnSync(
    process.execPath,
    [resolve(siteRoot, "scripts/launch-fork-control.mjs"), "status"],
    { cwd: siteRoot, encoding: "utf8" }
  );
  if (statusResult.status !== 0) {
    throw new Error(statusResult.stderr.trim() || "The Genesis launch-fork status check failed.");
  }
  const status = JSON.parse(statusResult.stdout);
  const playwright = spawnSync(
    "npx",
    [
      "playwright",
      "test",
      "test/e2e/genesis-launch-fork.spec.ts",
      "--config",
      "playwright.genesis-fork.config.ts",
    ],
    {
      cwd: siteRoot,
      stdio: "inherit",
      env: { ...process.env, CONNECTED_DAPP_URL: session.appUrl },
    }
  );
  if (playwright.status !== 0) {
    throw new Error(`Genesis fork browser verification exited with code ${playwright.status}.`);
  }
  mkdirSync(localDirectory, { recursive: true, mode: 0o700 });
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        sourceRepository: status.sourceRepository,
        protocolCommit: status.protocolCommit,
        sdkSourceCommit: status.sdkSourceCommit,
        forkBlock: status.forkBlock,
        forkBlockHash: status.forkBlockHash,
        deploymentStartBlock: status.deploymentStartBlock,
        deploymentChainId: status.deploymentChainId,
        interactiveChainId: status.chainId,
        contracts: status.contracts,
        ponderReady: status.ponderReady,
        indexedGenesisFixtureIds: status.indexedGenesisFixtureIds,
        genesis: status.genesis,
        appUrl: status.appUrl,
        browserExecution: "passed",
        routeAndDisconnectedSurfaceGate: "passed",
        ownerWalletLifecycle: "not-executed-without-deterministic-browser-wallet",
        secondWalletRecoveryAndTransfer: "covered-by-protocol-fork-proof",
        uiTransferControl: "not-present-in-app-pr-29",
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
  chmodSync(evidencePath, 0o600);
  process.stdout.write(`Wrote Genesis fork browser evidence to ${evidencePath}.\n`);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Genesis verification failed."}\n`
  );
  process.exitCode = 1;
}
