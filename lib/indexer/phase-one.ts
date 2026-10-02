import { getAddress, isHash, type Address, type Hex } from "viem";

import type { LaunchPoolKey } from "@/lib/deployments/types";
import { configuredIndexerUrlForDeployment, fetchIndexer } from "@/lib/indexer/statics";

export type IndexedPublicPool = Readonly<{
  poolId: Hex;
  creator: Address;
  poolKey: LaunchPoolKey;
  initialSqrtPriceX96: bigint;
  initialTick: number;
  inputFeeBps: number;
  outputFeeBps: number;
  feeRateOverridden: boolean;
  decommissioned: boolean;
  polActivated: boolean;
  createdAtBlock: bigint;
  updatedAtBlock: bigint;
}>;

export type IndexedPhaseOnePosition = Readonly<{
  positionId: bigint;
  owner: Address;
  stakedBalance: bigint;
  activeLegCount: bigint;
  unresolvedObligationCount: bigint;
  updatedAtBlock: bigint;
}>;

export type PhaseOneIndexedPage<T> = Readonly<{
  deploymentId: string;
  indexedAtBlock: bigint;
  items: readonly T[];
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  }
  return value as Record<string, unknown>;
}

function unsignedBigint(value: unknown, label: string): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  }
  return BigInt(value);
}

function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  }
  return Number(value);
}

function address(value: unknown, label: string): Address {
  try {
    if (typeof value !== "string") throw new Error();
    return getAddress(value);
  } catch {
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  }
}

function hash(value: unknown, label: string): Hex {
  if (typeof value !== "string" || !isHash(value)) {
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  }
  return value;
}

function page(value: unknown, deploymentId: string): Record<string, unknown> {
  const body = record(value, "response");
  if (body.deploymentId !== deploymentId) {
    throw new Error("The Phase 1 indexer returned data for a different deployment.");
  }
  if (!Array.isArray(body.items)) {
    throw new Error("The Phase 1 indexer returned an invalid item list.");
  }
  return body;
}

export function parseIndexedPublicPools(
  value: unknown,
  deploymentId: string
): PhaseOneIndexedPage<IndexedPublicPool> {
  const body = page(value, deploymentId);
  return {
    deploymentId,
    indexedAtBlock: unsignedBigint(body.indexedAtBlock, "indexed block"),
    items: (body.items as unknown[]).map((item) => {
      const row = record(item, "public pool");
      const poolKey = record(row.poolKey, "PoolKey");
      return {
        poolId: hash(row.poolId, "PoolId"),
        creator: address(row.creator, "creator"),
        poolKey: {
          currency0: address(poolKey.currency0, "currency0"),
          currency1: address(poolKey.currency1, "currency1"),
          fee: integer(poolKey.fee, "LP fee"),
          tickSpacing: integer(poolKey.tickSpacing, "tick spacing"),
          hooks: address(poolKey.hooks, "hook"),
        },
        initialSqrtPriceX96: unsignedBigint(row.initialSqrtPriceX96, "initial price"),
        initialTick: integer(row.initialTick, "initial tick"),
        inputFeeBps: integer(row.inputFeeBps, "input fee"),
        outputFeeBps: integer(row.outputFeeBps, "output fee"),
        feeRateOverridden: boolean(row.feeRateOverridden, "fee override flag"),
        decommissioned: boolean(row.decommissioned, "decommission flag"),
        polActivated: boolean(row.polActivated, "managed POL flag"),
        createdAtBlock: unsignedBigint(row.createdAtBlock, "creation block"),
        updatedAtBlock: unsignedBigint(row.updatedAtBlock, "update block"),
      };
    }),
  };
}

export function parseIndexedPositions(
  value: unknown,
  deploymentId: string
): PhaseOneIndexedPage<IndexedPhaseOnePosition> {
  const body = page(value, deploymentId);
  return {
    deploymentId,
    indexedAtBlock: unsignedBigint(body.indexedAtBlock, "indexed block"),
    items: (body.items as unknown[]).map((item) => {
      const row = record(item, "position");
      return {
        positionId: unsignedBigint(row.positionId, "position ID"),
        owner: address(row.owner, "position owner"),
        stakedBalance: unsignedBigint(row.stakedBalance, "staked balance"),
        activeLegCount: unsignedBigint(row.activeLegCount, "active leg count"),
        unresolvedObligationCount: unsignedBigint(
          row.unresolvedObligationCount,
          "unresolved obligation count"
        ),
        updatedAtBlock: unsignedBigint(row.updatedAtBlock, "update block"),
      };
    }),
  };
}

async function load(
  deploymentId: string,
  path: string,
  indexerUrl?: string | null
): Promise<unknown> {
  const base =
    indexerUrl === undefined ? configuredIndexerUrlForDeployment(deploymentId) : indexerUrl;
  if (!base) throw new Error("No Phase 1 indexer is configured for this deployment.");
  const response = await fetchIndexer(`${base}${path}`, "no-store");
  if (!response.ok) throw new Error(`Phase 1 indexer request failed (${response.status}).`);
  return response.json();
}

export async function loadIndexedPublicPools(
  deploymentId: string,
  indexerUrl?: string | null
): Promise<PhaseOneIndexedPage<IndexedPublicPool>> {
  return parseIndexedPublicPools(
    await load(deploymentId, "/phase-one/pools", indexerUrl),
    deploymentId
  );
}

export async function loadIndexedPhaseOnePositions(
  owner: Address,
  deploymentId: string,
  indexerUrl?: string | null
): Promise<PhaseOneIndexedPage<IndexedPhaseOnePosition>> {
  return parseIndexedPositions(
    await load(deploymentId, `/phase-one/wallets/${getAddress(owner)}/positions`, indexerUrl),
    deploymentId
  );
}
