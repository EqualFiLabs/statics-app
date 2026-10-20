import { describe, expect, it } from "vitest";
import {
  parsePublicDeploymentManifests,
  publicDeploymentSnapshot,
} from "@/lib/deployments/public-manifests";
import { deploymentRegistry } from "@/lib/deployments/registry";
import { runtimeManifests } from "@/test/fixtures/public-manifests";

describe("runtime public manifests", () => {
  it("validates a complete release and preserves Genesis alongside Phase 1", () => {
    const bundle = parsePublicDeploymentManifests(runtimeManifests());
    const snapshot = publicDeploymentSnapshot(bundle, "runtime-manifest");
    const options = deploymentRegistry({ NEXT_PUBLIC_APP_ENV: "production" }, snapshot);
    expect(options[0].launch?.source).toBe("runtime-manifest");
    expect(options[0].phaseOne?.source).toBe("runtime-manifest");
    expect(options[0].phaseOne?.contracts.diamond.toLowerCase()).toBe(`0x${"1".repeat(40)}`);
    expect(options[1].protocol).not.toBeNull();
    expect(snapshot.revision).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("does not supplement an authoritative empty release with old bundled contracts", () => {
    const empty = { schemaVersion: 1 as const, launch: {}, phaseOne: {}, protocol: {} };
    const options = deploymentRegistry(
      { NEXT_PUBLIC_APP_ENV: "production" },
      publicDeploymentSnapshot(empty, "runtime-manifest")
    );
    expect(options.every((o) => !o.descriptor.available)).toBe(true);
  });

  it.each([
    { schemaVersion: 2, launch: {}, phaseOne: {}, protocol: {} },
    { schemaVersion: 1, launch: [], phaseOne: {}, protocol: {} },
    { schemaVersion: 1, launch: {}, phaseOne: {}, protocol: {}, secret: "forbidden" },
    { schemaVersion: 1, launch: {}, phaseOne: {} },
  ])("rejects unsupported bundle shapes", (value) => {
    expect(() => parsePublicDeploymentManifests(value)).toThrow();
  });

  it("rejects unknown deployments, wrong chains and missing provenance", () => {
    const base = runtimeManifests();
    const phase = base.phaseOne["robinhood-phase-one"];
    for (const phaseOne of [
      { "local-anvil-phase-one": phase },
      { "robinhood-phase-one": { ...phase, chainId: 31337 } },
      { "robinhood-phase-one": { ...phase, deploymentStartBlock: "-1" } },
      { "robinhood-phase-one": { ...phase, protocolCommit: "unknown" } },
    ])
      expect(() => parsePublicDeploymentManifests({ ...base, phaseOne })).toThrow();
    expect(() =>
      parsePublicDeploymentManifests({ ...base, protocol: { 31337: base.protocol["46630"] } })
    ).toThrow();
  });

  it("retains address, hash and PoolKey validation", () => {
    const base = runtimeManifests();
    const phase = base.phaseOne["robinhood-phase-one"];
    expect(() =>
      parsePublicDeploymentManifests({
        ...base,
        phaseOne: {
          "robinhood-phase-one": {
            ...phase,
            contracts: { ...phase.contracts, diamond: { address: "invalid" } },
          },
        },
      })
    ).toThrow();
    const launch = base.launch["robinhood-genesis"];
    expect(() =>
      parsePublicDeploymentManifests({
        ...base,
        launch: {
          "robinhood-genesis": {
            ...launch,
            contracts: {
              ...launch.contracts,
              genesis: { address: launch.contracts.genesis.address },
            },
          },
        },
      })
    ).toThrow(/runtime code hash/);
    expect(() =>
      parsePublicDeploymentManifests({
        ...base,
        launch: {
          "robinhood-genesis": {
            ...launch,
            market: { ...launch.market, poolId: `0x${"0".repeat(64)}` },
          },
        },
      })
    ).toThrow(/PoolId/);
  });

  it("rejects unrecognized nested fields instead of publishing accidental private config", () => {
    const base = runtimeManifests();
    const phase = base.phaseOne["robinhood-phase-one"];
    expect(() =>
      parsePublicDeploymentManifests({
        ...base,
        phaseOne: { "robinhood-phase-one": { ...phase, rpcUrl: "private" } },
      })
    ).toThrow(/public field/);
    expect(() =>
      parsePublicDeploymentManifests({
        ...base,
        phaseOne: {
          "robinhood-phase-one": {
            ...phase,
            contracts: {
              ...phase.contracts,
              diamond: { ...phase.contracts.diamond, key: "private" },
            },
          },
        },
      })
    ).toThrow(/public field/);
  });

  it("preserves chain-4663 local fork identity when public runtime configuration is present", () => {
    const base = runtimeManifests();
    const local = {
      ...base.phaseOne["robinhood-phase-one"],
      deploymentId: "local-anvil-phase-one",
      network: "Local fork",
    };
    const options = deploymentRegistry(
      {
        NEXT_PUBLIC_APP_ENV: "development",
        NEXT_PUBLIC_APP_NETWORK: "anvil",
        NEXT_PUBLIC_ANVIL_CHAIN_ID: "4663",
        NEXT_PUBLIC_STATICS_LOCAL_PHASE_ONE_MANIFEST: JSON.stringify(local),
      },
      publicDeploymentSnapshot(base, "runtime-manifest")
    );
    expect(options.map((o) => o.networkId)).toEqual(["anvil", "robinhood-testnet"]);
    expect(options[0].phaseOne?.source).toBe("development-fixture");
  });
});
