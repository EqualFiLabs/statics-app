import { getAddress, isHash, type Address, type Hex } from "viem";

import { v4PoolId } from "@statics-protocol/sdk";

import type {
  DeploymentDescriptor,
  LaunchContractName,
  LaunchDeployment,
  LaunchPoolKey,
} from "@/lib/deployments/types";

type ManifestContract = Readonly<{ address: string; runtimeCodeHash?: string }>;

export type LaunchDeploymentManifest = Readonly<{
  schemaVersion: 1;
  deploymentId: string;
  network: string;
  chainId: number;
  deploymentStartBlock: string;
  protocolCommit: string;
  contracts: Readonly<Record<LaunchContractName, ManifestContract>>;
  market: Readonly<{
    poolId: string;
    poolKey: Readonly<{
      currency0: string;
      currency1: string;
      fee: number;
      tickSpacing: number;
      hooks: string;
    }>;
  }>;
}>;

const launchCapabilities = [
  "overview",
  "canonical-statics-market",
  "genesis-vault",
  "genesis-activation",
  "genesis-launch-rewards",
  "wallet",
  "activity",
  "approval-tools",
] as const;

function address(value: string, field: string): Address {
  try {
    return getAddress(value);
  } catch {
    throw new Error(`${field} must be a valid EVM address.`);
  }
}

function hash(value: string, field: string): Hex {
  if (!isHash(value)) throw new Error(`${field} must be a 32-byte hash.`);
  return value;
}

export function parseLaunchDeploymentManifest(
  manifest: LaunchDeploymentManifest,
  source: LaunchDeployment["source"] = "checked-in-manifest"
): LaunchDeployment {
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported launch manifest schema.");
  if (!manifest.deploymentId.trim()) throw new Error("Launch deploymentId is required.");
  if (!Number.isSafeInteger(manifest.chainId) || manifest.chainId <= 0) {
    throw new Error("Launch chainId must be a positive integer.");
  }
  const deploymentStartBlock = BigInt(manifest.deploymentStartBlock);
  const contracts = Object.fromEntries(
    Object.entries(manifest.contracts).map(([name, contract]) => [
      name,
      address(contract.address, `contracts.${name}.address`),
    ])
  ) as Record<LaunchContractName, Address>;
  const runtimeCodeHashes = Object.fromEntries(
    Object.entries(manifest.contracts)
      .filter(([, contract]) => Boolean(contract.runtimeCodeHash))
      .map(([name, contract]) => [
        name,
        hash(contract.runtimeCodeHash!, `contracts.${name}.runtimeCodeHash`),
      ])
  ) as Partial<Record<LaunchContractName, Hex>>;
  if (
    source === "checked-in-manifest" &&
    Object.keys(runtimeCodeHashes).length !== Object.keys(manifest.contracts).length
  ) {
    throw new Error("Every checked-in launch contract requires a reviewed runtime code hash.");
  }
  const poolKey: LaunchPoolKey = {
    currency0: address(manifest.market.poolKey.currency0, "market.poolKey.currency0"),
    currency1: address(manifest.market.poolKey.currency1, "market.poolKey.currency1"),
    fee: manifest.market.poolKey.fee,
    tickSpacing: manifest.market.poolKey.tickSpacing,
    hooks: address(manifest.market.poolKey.hooks, "market.poolKey.hooks"),
  };
  if (poolKey.currency0.toLowerCase() >= poolKey.currency1.toLowerCase()) {
    throw new Error("Launch pool currencies must be in canonical address order.");
  }
  if (!Number.isInteger(poolKey.fee) || poolKey.fee < 0 || poolKey.fee > 0xffffff) {
    throw new Error("Launch pool fee must fit uint24.");
  }
  if (!Number.isInteger(poolKey.tickSpacing) || poolKey.tickSpacing <= 0) {
    throw new Error("Launch tick spacing must be a positive integer.");
  }
  if (
    ![poolKey.currency0, poolKey.currency1].some(
      (currency) => currency.toLowerCase() === contracts.statics.toLowerCase()
    ) ||
    ![poolKey.currency0, poolKey.currency1].some(
      (currency) => currency.toLowerCase() === contracts.weth.toLowerCase()
    )
  ) {
    throw new Error("Launch pool must be the manifest STATICS/WETH pair.");
  }
  const poolId = hash(manifest.market.poolId, "market.poolId");
  if (v4PoolId(poolKey).toLowerCase() !== poolId.toLowerCase()) {
    throw new Error("Launch PoolId does not match the canonical PoolKey.");
  }

  const descriptor: DeploymentDescriptor = {
    deploymentId: manifest.deploymentId,
    label: "Statics Genesis",
    network: manifest.network,
    chainId: manifest.chainId,
    stage: "launch",
    capabilities: launchCapabilities,
    available: true,
  };
  return {
    kind: "launch",
    descriptor,
    deploymentStartBlock,
    protocolCommit: manifest.protocolCommit,
    source,
    contracts,
    runtimeCodeHashes,
    market: { poolId, poolKey },
  };
}
