/**
 * Checked-in deployment manifests.
 *
 * The environment path in ./deployment.ts is restricted to local Anvil, and
 * refuses every other chain with a message naming a manifest that did not
 * exist. This is that manifest: a reviewed JSON file per chain, generated from
 * a live deployment by scripts/generate-deployment-manifest.mjs and committed.
 *
 * Generated rather than hand-written on purpose. Every runtime code hash is
 * read from the chain at generation time, so the file records what is actually
 * deployed rather than what somebody believed was deployed. It is still
 * committed, so pointing the app at new contracts is a reviewable diff and not
 * an environment variable somebody set on a build machine.
 *
 * The manifest is only half the check. verifyDollarDeployment re-reads every
 * runtime code hash from the connected chain before any transaction path is
 * offered, so a manifest that has drifted from the chain fails closed rather
 * than quietly addressing the wrong contracts.
 */

import { getAddress, isHash, type Address, type Hex } from "viem";

import type {
  DollarContractName,
  DollarDeployment,
  LiquidityContractName,
} from "@/lib/dollar/deployment";

/** Bump when the shape changes so an older generator cannot write a newer app. */
export const MANIFEST_SCHEMA_VERSION = 1;

const dollarContractNames: readonly DollarContractName[] = [
  "diamond",
  "core",
  "gateway",
  "dollar",
  "risk",
  "weth",
  "oracle",
];

const liquidityContractNames: readonly LiquidityContractName[] = [
  "poolManager",
  "positionManager",
  "permit2",
  "swapFeeHook",
  "liquidityManager",
  "stateView",
];

type RawEntry = Readonly<{ address: string; runtimeCodeHash: string }>;

export type DeploymentManifest = Readonly<{
  schemaVersion: number;
  network: string;
  chainId: number;
  deploymentStartBlock: string;
  wethProfileId: string;
  protocolCommit: string;
  generatedAt: string;
  contracts: Readonly<Record<string, RawEntry>>;
  liquidity?: Readonly<Record<string, RawEntry>> | null;
  pegged?: Readonly<{
    profileId: string;
    collateral: RawEntry;
    oracle: RawEntry;
  }> | null;
}>;

function fail(chainId: number | string, reason: string): never {
  throw new Error(`Deployment manifest for chain ${chainId} is invalid: ${reason}`);
}

function readEntry(chainId: number | string, name: string, entry: RawEntry | undefined) {
  if (!entry) fail(chainId, `${name} is missing.`);
  let address: Address;
  try {
    address = getAddress(entry.address);
  } catch {
    return fail(chainId, `${name} has an invalid address.`);
  }
  if (!isHash(entry.runtimeCodeHash)) {
    fail(chainId, `${name} has an invalid runtime code hash.`);
  }
  return { address, runtimeCodeHash: entry.runtimeCodeHash as Hex };
}

function readDigits(chainId: number | string, name: string, value: string | undefined): bigint {
  if (!value || !/^\d+$/.test(value)) fail(chainId, `${name} must be a non-negative integer.`);
  return BigInt(value);
}

/**
 * Validates a manifest and converts it into the deployment the app already
 * consumes, so nothing downstream needs to know where a deployment came from.
 *
 * Throws rather than returning an unavailable state: a malformed manifest is a
 * broken build, not a chain the app happens not to be configured for.
 */
export function parseDeploymentManifest(manifest: DeploymentManifest): DollarDeployment {
  const chainId = manifest.chainId;

  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    fail(
      chainId,
      `schema version ${manifest.schemaVersion} is not the supported ${MANIFEST_SCHEMA_VERSION}.`
    );
  }
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    fail(chainId, "chainId must be a positive integer.");
  }
  if (!/^[a-f0-9]{40}$/i.test(manifest.protocolCommit ?? "")) {
    fail(chainId, "protocolCommit must be a full Git commit.");
  }

  const contracts: Record<string, Address> = {};
  const runtimeCodeHashes: Record<string, Hex> = {};
  for (const name of dollarContractNames) {
    const entry = readEntry(chainId, name, manifest.contracts?.[name]);
    contracts[name] = entry.address;
    runtimeCodeHashes[name] = entry.runtimeCodeHash;
  }

  let liquidity: DollarDeployment["liquidity"] = null;
  if (manifest.liquidity) {
    const addresses: Record<string, Address> = {};
    const hashes: Record<string, Hex> = {};
    for (const name of liquidityContractNames) {
      const entry = readEntry(chainId, `liquidity.${name}`, manifest.liquidity[name]);
      addresses[name] = entry.address;
      hashes[name] = entry.runtimeCodeHash;
    }
    liquidity = {
      contracts: addresses as DollarDeployment["contracts"] &
        Record<LiquidityContractName, Address>,
      runtimeCodeHashes: hashes as Record<LiquidityContractName, Hex>,
    };
  }

  let pegged: DollarDeployment["pegged"] = null;
  if (manifest.pegged) {
    const collateral = readEntry(chainId, "pegged.collateral", manifest.pegged.collateral);
    const oracle = readEntry(chainId, "pegged.oracle", manifest.pegged.oracle);
    pegged = {
      collateral: collateral.address,
      oracle: oracle.address,
      profileId: readDigits(chainId, "pegged.profileId", manifest.pegged.profileId),
      collateralCodeHash: collateral.runtimeCodeHash,
      oracleCodeHash: oracle.runtimeCodeHash,
    };
  }

  return {
    chainId,
    deploymentStartBlock: readDigits(
      chainId,
      "deploymentStartBlock",
      manifest.deploymentStartBlock
    ),
    wethProfileId: readDigits(chainId, "wethProfileId", manifest.wethProfileId),
    protocolCommit: manifest.protocolCommit,
    // Distinguishes a reviewed manifest from the Anvil-only environment path,
    // so anything that cares which it is reading can tell.
    source: "checked-in-manifest",
    contracts: contracts as Record<DollarContractName, Address>,
    runtimeCodeHashes: runtimeCodeHashes as Record<DollarContractName, Hex>,
    liquidity,
    pegged,
  };
}
