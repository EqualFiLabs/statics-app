import { keccak256, stringToHex, type Hex } from "viem";

import { launchDeploymentManifests } from "@/deployments/launch-manifests";
import { deploymentManifests } from "@/deployments/manifests";
import { phaseOneDeploymentManifests } from "@/deployments/phase-one-manifests";
import { parseDeploymentManifest, type DeploymentManifest } from "@/lib/dollar/manifest";
import { parseLaunchDeploymentManifest, type LaunchDeploymentManifest } from "./launch-manifest";
import {
  parsePhaseOneDeploymentManifest,
  type PhaseOneDeploymentManifest,
} from "./phase-one-manifest";

/** Complete public configuration; omitted networks remain unavailable. */
export type PublicDeploymentManifests = Readonly<{
  schemaVersion: 1;
  launch: Readonly<Record<string, LaunchDeploymentManifest>>;
  phaseOne: Readonly<Record<string, PhaseOneDeploymentManifest>>;
  protocol: Readonly<Record<string, DeploymentManifest>>;
}>;

export type PublicDeploymentSnapshot = Readonly<{
  revision: Hex;
  source: "checked-in-manifest" | "runtime-manifest";
  manifests: PublicDeploymentManifests;
}>;

const launchIds: Record<string, number> = {
  "robinhood-genesis": 4663,
  "robinhood-testnet-genesis": 46630,
};
const phaseOneIds: Record<string, number> = {
  "robinhood-phase-one": 4663,
  "robinhood-testnet-phase-one": 46630,
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function identity(value: unknown, id: string, chain: number | undefined) {
  const manifest = object(value, "Deployment manifest");
  if (!chain || manifest.chainId !== chain || manifest.deploymentId !== id) {
    throw new Error("Public deployment identity does not match its network.");
  }
  if (
    typeof manifest.deploymentStartBlock !== "string" ||
    !/^\d+$/.test(manifest.deploymentStartBlock) ||
    typeof manifest.network !== "string" ||
    !manifest.network.trim() ||
    typeof manifest.protocolCommit !== "string" ||
    !/^[0-9a-f]{40}$/i.test(manifest.protocolCommit)
  )
    throw new Error("Public deployment provenance is invalid.");
}

function keys(value: unknown, allowed: readonly string[], label: string) {
  const fields = object(value, label);
  if (Object.keys(fields).some((key) => !allowed.includes(key))) {
    throw new Error(`Unsupported public field in ${label}.`);
  }
}

function entries(value: unknown) {
  for (const entry of Object.values(object(value, "contract entries")))
    keys(entry, ["address", "runtimeCodeHash"], "contract entry");
}

function publicFields(value: unknown, kind: "launch" | "phaseOne" | "protocol") {
  const m = object(value, "manifest");
  const common = [
    "schemaVersion",
    "network",
    "chainId",
    "deploymentStartBlock",
    "protocolCommit",
    "contracts",
  ];
  keys(
    m,
    [
      ...common,
      ...(kind === "launch"
        ? ["deploymentId", "analytics", "market"]
        : kind === "phaseOne"
          ? [
              "deploymentId",
              "sdkCommit",
              "installedPhase",
              "facetFingerprint",
              "facets",
              "supportedPools",
            ]
          : ["wethProfileId", "source", "generatedAt", "genesis", "liquidity", "pegged", "faucet"]),
    ],
    "manifest"
  );
  entries(m.contracts);
  if (kind === "launch") {
    const market = object(m.market, "market");
    keys(market, ["poolId", "poolKey", "initializationBlock"], "market");
    keys(market.poolKey, ["currency0", "currency1", "fee", "tickSpacing", "hooks"], "PoolKey");
    if (
      market.initializationBlock !== undefined &&
      (typeof market.initializationBlock !== "string" || !/^\d+$/.test(market.initializationBlock))
    )
      throw new Error("Invalid initialization block.");
    if (m.analytics) {
      const a = object(m.analytics, "analytics");
      keys(a, ["treasuryBeneficiary", "treasuryVesting", "reservesLens"], "analytics");
      entries({ treasuryVesting: a.treasuryVesting, reservesLens: a.reservesLens });
    }
  } else if (kind === "phaseOne") {
    if (!Array.isArray(m.supportedPools)) throw new Error("Supported pools must be an array.");
    for (const value of m.supportedPools) {
      const pool = object(value, "pool");
      keys(pool, ["poolId", "poolKey", "token0", "token1", "enabled", "registrationBlock"], "pool");
      if (typeof pool.enabled !== "boolean") throw new Error("Pool enabled must be a boolean.");
      keys(pool.poolKey, ["currency0", "currency1", "fee", "tickSpacing", "hooks"], "PoolKey");
      for (const token of [pool.token0, pool.token1])
        keys(token, ["address", "name", "symbol", "decimals", "logoUri"], "token");
    }
    if (m.facets !== undefined) {
      if (!Array.isArray(m.facets)) throw new Error("Facets must be an array.");
      for (const facet of m.facets)
        keys(facet, ["address", "runtimeCodeHash", "selectors"], "facet");
    }
  } else {
    keys(
      m.source,
      ["repository", "publicCommit", "deploymentArtifact", "recordedDeploymentCommit"],
      "source"
    );
    keys(m.genesis, ["token", "collection", "renderer", "avatarSvg"], "genesis");
    entries(m.genesis);
    if (m.liquidity) entries(m.liquidity);
    if (m.pegged) {
      const pegged = object(m.pegged, "pegged");
      keys(pegged, ["profileId", "collateral", "oracle"], "pegged");
      entries({ collateral: pegged.collateral, oracle: pegged.oracle });
    }
    if (m.faucet) entries({ faucet: m.faucet });
  }
}

export function parsePublicDeploymentManifests(value: unknown): PublicDeploymentManifests {
  const root = object(value, "Public deployment configuration");
  if (
    root.schemaVersion !== 1 ||
    Object.keys(root).some((k) => !["schemaVersion", "launch", "phaseOne", "protocol"].includes(k))
  ) {
    throw new Error("Unsupported public deployment configuration.");
  }
  const launch = object(root.launch, "launch");
  const phaseOne = object(root.phaseOne, "phaseOne");
  const protocol = object(root.protocol, "protocol");
  for (const [id, manifest] of Object.entries(launch)) {
    identity(manifest, id, Object.hasOwn(launchIds, id) ? launchIds[id] : undefined);
    publicFields(manifest, "launch");
    parseLaunchDeploymentManifest(manifest as LaunchDeploymentManifest, "runtime-manifest");
  }
  for (const [id, manifest] of Object.entries(phaseOne)) {
    identity(manifest, id, Object.hasOwn(phaseOneIds, id) ? phaseOneIds[id] : undefined);
    publicFields(manifest, "phaseOne");
    parsePhaseOneDeploymentManifest(manifest as PhaseOneDeploymentManifest, "runtime-manifest");
  }
  for (const [chain, value] of Object.entries(protocol)) {
    const manifest = object(value, "Protocol manifest");
    if (!["4663", "46630"].includes(chain) || manifest.chainId !== Number(chain)) {
      throw new Error("Public protocol identity does not match its network.");
    }
    publicFields(manifest, "protocol");
    parseDeploymentManifest(manifest as DeploymentManifest);
  }
  // Round-trip strips object prototypes and produces only JSON-safe data for client props.
  return JSON.parse(JSON.stringify(root)) as PublicDeploymentManifests;
}

export function publicDeploymentSnapshot(
  manifests: PublicDeploymentManifests,
  source: PublicDeploymentSnapshot["source"]
): PublicDeploymentSnapshot {
  return { manifests, source, revision: keccak256(stringToHex(JSON.stringify(manifests))) };
}

export function checkedInDeploymentSnapshot(): PublicDeploymentSnapshot {
  return publicDeploymentSnapshot(
    {
      schemaVersion: 1,
      launch: launchDeploymentManifests,
      phaseOne: phaseOneDeploymentManifests,
      protocol: deploymentManifests,
    },
    "checked-in-manifest"
  );
}
