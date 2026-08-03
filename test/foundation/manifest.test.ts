import { describe, expect, it } from "vitest";

import { readDollarDeployment } from "@/lib/dollar/deployment";
import {
  MANIFEST_SCHEMA_VERSION,
  parseDeploymentManifest,
  type DeploymentManifest,
} from "@/lib/dollar/manifest";

const address = (last: string) => `0x${last.repeat(40).slice(0, 40)}`;
const hash = (last: string) => `0x${last.repeat(64).slice(0, 64)}`;

const entry = (a: string, h: string) => ({ address: address(a), runtimeCodeHash: hash(h) });

function manifest(overrides: Partial<DeploymentManifest> = {}): DeploymentManifest {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    network: "Robinhood Chain Testnet",
    chainId: 46_630,
    deploymentStartBlock: "1234",
    wethProfileId: "1",
    protocolCommit: "a".repeat(40),
    source: {
      repository: "https://github.com/EqualFiLabs/statics",
      publicCommit: "b".repeat(40),
      deploymentArtifact: "deployments/robinhood-testnet-46630-statics.json",
      recordedDeploymentCommit: "a".repeat(40),
    },
    generatedAt: "2026-07-27T00:00:00.000Z",
    contracts: {
      diamond: entry("1", "1"),
      core: entry("2", "2"),
      gateway: entry("3", "3"),
      dollar: entry("4", "4"),
      risk: entry("5", "5"),
      weth: entry("6", "6"),
      oracle: entry("7", "7"),
    },
    positionMetadata: {
      renderer: entry("8", "8"),
      avatarSvg: entry("9", "9"),
    },
    liquidity: null,
    pegged: null,
    ...overrides,
  };
}

describe("deployment manifest", () => {
  it("converts a reviewed manifest into the deployment the app consumes", () => {
    const deployment = parseDeploymentManifest(manifest());

    expect(deployment.chainId).toBe(46_630);
    expect(deployment.deploymentStartBlock).toBe(1234n);
    expect(deployment.wethProfileId).toBe(1n);
    // Distinguishable from the Anvil-only environment path.
    expect(deployment.source).toBe("checked-in-manifest");
    expect(deployment.contracts.diamond).toBe(address("1"));
    expect(deployment.runtimeCodeHashes.diamond).toBe(hash("1"));
    expect(deployment.positionMetadata?.renderer).toBe(address("8"));
  });

  it("refuses a manifest written against a different schema", () => {
    // A newer generator writing a shape this build cannot read must fail loudly
    // rather than produce a half-populated deployment.
    expect(() => parseDeploymentManifest(manifest({ schemaVersion: 99 }))).toThrow(
      /schema version 99/
    );
  });

  it("refuses a manifest missing any contract", () => {
    const broken = manifest();
    const contracts = { ...broken.contracts };
    delete (contracts as Record<string, unknown>).gateway;
    expect(() => parseDeploymentManifest({ ...broken, contracts })).toThrow(/gateway is missing/);
  });

  it("refuses an address that is not an address", () => {
    const broken = manifest();
    expect(() =>
      parseDeploymentManifest({
        ...broken,
        contracts: {
          ...broken.contracts,
          core: { address: "not-an-address", runtimeCodeHash: hash("2") },
        },
      })
    ).toThrow(/core has an invalid address/);
  });

  it("refuses a runtime code hash that is not a hash", () => {
    // The hash is the only thing binding an address to reviewed bytecode, so a
    // malformed one has to stop the build rather than skip the check.
    const broken = manifest();
    expect(() =>
      parseDeploymentManifest({
        ...broken,
        contracts: {
          ...broken.contracts,
          risk: { address: address("5"), runtimeCodeHash: "0xdead" },
        },
      })
    ).toThrow(/risk has an invalid runtime code hash/);
  });

  it("refuses a commit that is not a full git sha", () => {
    expect(() => parseDeploymentManifest(manifest({ protocolCommit: "abc123" }))).toThrow(
      /full Git commit/
    );
  });

  it("requires reachable public provenance without changing deployed identity", () => {
    expect(() =>
      parseDeploymentManifest(
        manifest({
          source: {
            repository: "https://user:secret@example.test/statics",
            publicCommit: "b".repeat(40),
            deploymentArtifact: "deployments/robinhood-testnet-46630-statics.json",
            recordedDeploymentCommit: "a".repeat(40),
          },
        })
      )
    ).toThrow("credential-free HTTPS URL");
    expect(() =>
      parseDeploymentManifest(
        manifest({
          source: {
            repository: "https://github.com/EqualFiLabs/statics",
            publicCommit: "b".repeat(40),
            deploymentArtifact: "../private/deployment.json",
            recordedDeploymentCommit: "a".repeat(40),
          },
        })
      )
    ).toThrow("public deployment record");
    expect(() =>
      parseDeploymentManifest(
        manifest({
          source: {
            repository: "https://github.com/EqualFiLabs/statics",
            publicCommit: "b".repeat(40),
            deploymentArtifact: "deployments/robinhood-testnet-46630-statics.json",
            recordedDeploymentCommit: "c".repeat(40),
          },
        })
      )
    ).toThrow("must match protocolCommit");
  });

  it("requires both code-bound Position metadata contracts", () => {
    const broken = manifest();
    expect(() =>
      parseDeploymentManifest({
        ...broken,
        positionMetadata: {
          renderer: broken.positionMetadata.renderer,
        } as DeploymentManifest["positionMetadata"],
      })
    ).toThrow(/positionMetadata\.avatarSvg is missing/);
  });

  it("requires every liquidity contract once liquidity is present", () => {
    expect(() =>
      parseDeploymentManifest(
        manifest({ liquidity: { poolManager: entry("8", "8") } as DeploymentManifest["liquidity"] })
      )
    ).toThrow(/liquidity\.positionManager is missing/);
  });

  it("carries the pegged profile through when one is deployed", () => {
    const deployment = parseDeploymentManifest(
      manifest({
        pegged: { profileId: "2", collateral: entry("9", "9"), oracle: entry("a", "a") },
      })
    );
    expect(deployment.pegged?.profileId).toBe(2n);
    expect(deployment.pegged?.collateral).toBe(address("9"));
  });

  it("carries an optional code-bound public testnet faucet", () => {
    const deployment = parseDeploymentManifest(manifest({ faucet: entry("b", "b") }));

    expect(deployment.faucet?.address.toLowerCase()).toBe(address("b"));
    expect(deployment.faucet?.runtimeCodeHash).toBe(hash("b"));
  });
});

describe("deployment source selection", () => {
  const anvilEnvironment = {
    NEXT_PUBLIC_APP_ENV: "development",
    NEXT_PUBLIC_STATICS_CHAIN_ID: "31337",
  };

  it("reports an unconfigured chain rather than throwing", () => {
    // Previously any non-development environment threw on import, naming a
    // manifest mechanism that did not exist. A chain without a reviewed
    // manifest is simply not configured.
    const state = readDollarDeployment({
      ...anvilEnvironment,
      NEXT_PUBLIC_APP_ENV: "production",
      NEXT_PUBLIC_STATICS_CHAIN_ID: "8453",
      NEXT_PUBLIC_STATICS_DIAMOND_ADDRESS: address("1"),
    });

    expect(state.status).toBe("unavailable");
    expect(state.status === "unavailable" && state.reason).toMatch(/chain 8453/);
  });

  it("uses the checked-in manifest instead of public environment addresses", () => {
    // The environment path is the thing being contained: setting these on a
    // build machine must not configure a public network.
    const state = readDollarDeployment({
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_STATICS_CHAIN_ID: "46630",
      NEXT_PUBLIC_STATICS_DIAMOND_ADDRESS: address("1"),
      NEXT_PUBLIC_STATICS_DOLLAR_CORE_ADDRESS: address("2"),
    });

    expect(state.status).toBe("configured");
    if (state.status === "configured") {
      expect(state.deployment.source).toBe("checked-in-manifest");
      expect(state.deployment.contracts.diamond).not.toBe(address("1"));
    }
  });

  it("still reports nothing configured when no deployment is set at all", () => {
    expect(readDollarDeployment({}).status).toBe("unavailable");
  });
});
