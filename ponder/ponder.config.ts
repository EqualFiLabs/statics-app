import { createConfig } from "ponder";
import { getAddress, parseAbi, zeroAddress, zeroHash } from "viem";

import {
  genesisActivationRegistryAbi,
  genesisLaunchDistributorAbi,
  morphoBlueAbi,
  staticsAbi,
  staticsFeeReceiverAbi,
  staticsGenesisAbi,
  v4PositionManagerReadAbi,
} from "@statics-protocol/sdk";

import { staticsGenesisCreditAbi } from "@statics-protocol/sdk/genesis-credit";

import { configuredAddress, configuredCanonicalPool } from "./src/source-config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optionalAddress(name: string) {
  const value = process.env[name]?.trim();
  return value ? getAddress(value) : zeroAddress;
}

function optionalStartBlock(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a block number.`);
  return value;
}

const chainId = Number(required("PONDER_CHAIN_ID"));
if (!Number.isSafeInteger(chainId) || chainId <= 0) {
  throw new Error("PONDER_CHAIN_ID must be a positive integer.");
}
const deploymentStartBlock = optionalStartBlock("PONDER_DEPLOYMENT_START_BLOCK", 0);
const poolManagerEventsAbi = parseAbi([
  "event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)",
]);
const staticsAddress = configuredAddress("PONDER_STATICS_DIAMOND_ADDRESS");
const positionManagerAddress = configuredAddress("PONDER_POSITION_MANAGER_ADDRESS");
const poolManagerAddress = configuredAddress("PONDER_POOL_MANAGER_ADDRESS");
const canonicalPoolId = configuredCanonicalPool(poolManagerAddress);
const morphoAddress = configuredAddress("PONDER_MORPHO_ADDRESS");

function activeContracts<T extends Record<string, unknown>>(contracts: T): T {
  if (!staticsAddress) delete contracts.Statics;
  if (!positionManagerAddress) delete contracts.PositionManager;
  if (!poolManagerAddress) delete contracts.PoolManager;
  if (!morphoAddress) delete contracts.Morpho;
  return contracts;
}

/**
 * One network per process. Run separate mainnet, testnet, or local-fork
 * instances with different env files; the schema and handlers stay identical.
 * Full-protocol sources are omitted when their addresses are not configured,
 * avoiding unnecessary filters while preserving one schema and handler set.
 */
export default createConfig({
  ...(process.env.PONDER_DATABASE_DIRECTORY?.trim()
    ? {
        database: {
          kind: "pglite" as const,
          directory: process.env.PONDER_DATABASE_DIRECTORY.trim(),
        },
      }
    : {}),
  chains: {
    active: {
      id: chainId,
      rpc: required(`PONDER_RPC_URL_${chainId}`),
      pollingInterval: chainId === 4_663 ? 2_000 : undefined,
    },
  },
  contracts: activeContracts({
    Statics: {
      chain: "active",
      abi: staticsAbi,
      address: staticsAddress ?? zeroAddress,
      startBlock: optionalStartBlock("PONDER_STATICS_START_BLOCK", deploymentStartBlock),
    },
    PositionManager: {
      chain: "active",
      abi: v4PositionManagerReadAbi,
      address: positionManagerAddress ?? zeroAddress,
      startBlock: optionalStartBlock("PONDER_POSITION_MANAGER_START_BLOCK", deploymentStartBlock),
    },
    StaticsGenesis: {
      chain: "active",
      abi: staticsGenesisAbi,
      address: optionalAddress("PONDER_STATICS_GENESIS_ADDRESS"),
      startBlock: optionalStartBlock("PONDER_STATICS_GENESIS_START_BLOCK", deploymentStartBlock),
    },
    GenesisVault: {
      chain: "active",
      abi: staticsGenesisCreditAbi,
      address: optionalAddress("PONDER_GENESIS_VAULT_ADDRESS"),
      startBlock: optionalStartBlock("PONDER_GENESIS_VAULT_START_BLOCK", deploymentStartBlock),
    },
    GenesisActivationRegistry: {
      chain: "active",
      abi: genesisActivationRegistryAbi,
      address: optionalAddress("PONDER_GENESIS_ACTIVATION_REGISTRY_ADDRESS"),
      startBlock: optionalStartBlock("PONDER_GENESIS_ACTIVATION_START_BLOCK", deploymentStartBlock),
    },
    GenesisLaunchDistributor: {
      chain: "active",
      abi: genesisLaunchDistributorAbi,
      address: optionalAddress("PONDER_GENESIS_LAUNCH_DISTRIBUTOR_ADDRESS"),
      startBlock: optionalStartBlock(
        "PONDER_GENESIS_DISTRIBUTOR_START_BLOCK",
        deploymentStartBlock
      ),
    },
    StaticsFeeReceiver: {
      chain: "active",
      abi: staticsFeeReceiverAbi,
      address: optionalAddress("PONDER_STATICS_FEE_RECEIVER_ADDRESS"),
      startBlock: optionalStartBlock(
        "PONDER_STATICS_FEE_RECEIVER_START_BLOCK",
        deploymentStartBlock
      ),
    },
    PoolManager: {
      chain: "active",
      abi: poolManagerEventsAbi,
      address: poolManagerAddress ?? zeroAddress,
      startBlock: optionalStartBlock("PONDER_POOL_MANAGER_START_BLOCK", deploymentStartBlock),
      filter: { event: "Swap", args: { id: canonicalPoolId ?? zeroHash } },
    },
    Morpho: {
      chain: "active",
      abi: morphoBlueAbi,
      address: morphoAddress ?? zeroAddress,
      startBlock: optionalStartBlock("PONDER_MORPHO_START_BLOCK", deploymentStartBlock),
    },
  } as const),
});
