import {
  getAddress,
  isHash,
  zeroAddress,
  type AbiParameter,
  type Address,
  type ContractEventArgs,
  type Hex,
} from "viem";
import { staticsAbi } from "@statics-protocol/sdk/phase-one";

export const statementCategories = {
  PositionCreated: "lifecycle",
  PositionClosed: "lifecycle",
  PositionCreationFeePaid: "lifecycle",
  Transfer: "lifecycle",
  Staked: "staking",
  Unstaked: "staking",
  ManagedLiquidityProvided: "liquidity",
  ManagedLiquidityAttached: "liquidity",
  ManagedLiquidityChanged: "liquidity",
  ManagedLiquidityRebalanced: "liquidity",
  ManagedLiquidityExited: "liquidity",
  ManagedLiquidityFeesCollected: "liquidity",
  PositionGaugeAllocationsSet: "allocations",
  PositionGaugeAllocationCooldownExtended: "allocations",
  PositionGaugeAllocationsClearedByStakeLoss: "allocations",
  RewardAssetOptedIn: "rewards",
  RewardAssetOptedOut: "rewards",
  RewardStakeScheduled: "rewards",
  PositionRewardEligibilityActivated: "rewards",
  PositionRewardWeightChanged: "rewards",
  PositionRewardSettled: "rewards",
  RewardClaimed: "rewards",
  LpRewardsClaimed: "rewards",
  LpRewardForfeited: "rewards",
  GaugeAllocatorRewardClaimed: "rewards",
  GaugeAllocatorRewardForfeited: "rewards",
} as const;
export type StatementEventName = keyof typeof statementCategories;
export type StatementCategory = (typeof statementCategories)[StatementEventName];
export type StatementPayload = {
  [Name in StatementEventName]: {
    eventName: Name;
    payload: ContractEventArgs<typeof staticsAbi, Name>;
  };
}[StatementEventName];
const purposes = [
  "stake",
  "unstake",
  "creation-fee",
  "trading-fees",
  "liquidity-funding",
  "liquidity-refund",
  "liquidity-output",
  "rebalance-withdrawal",
  "rebalance-mint-spend",
  "rebalance-mint-return",
  "reward-payout-debit",
  "reward-payout",
  "reward-settlement",
  "reward-forfeiture",
] as const;
const fail = (): never => {
  throw new Error("The Phase 1 indexer returned an invalid position statement.");
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
function uint(value: unknown, bits = 256): bigint {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) return fail();
  const n = BigInt(value);
  if (n >= 1n << BigInt(bits)) return fail();
  return n;
}
function address(value: unknown): Address {
  if (typeof value !== "string") return fail();
  try {
    return getAddress(value);
  } catch {
    return fail();
  }
}
function hash(value: unknown): Hex {
  if (typeof value !== "string" || !isHash(value)) return fail();
  return value;
}
function nullable<T>(value: unknown, parse: (value: unknown) => T): T | null {
  return value === null ? null : parse(value);
}
function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max) return fail();
  return Number(value);
}
function parameter(value: unknown, field: AbiParameter): unknown {
  if (field.type.endsWith("[]")) {
    if (!Array.isArray(value)) return fail();
    return value.map((v) =>
      parameter(v, { ...field, type: field.type.slice(0, -2) } as AbiParameter)
    );
  }
  if (field.type === "tuple" && "components" in field) return parameters(value, field.components);
  if (field.type === "address") return address(value);
  if (field.type === "bytes32") return hash(value);
  if (field.type === "bool") {
    if (typeof value !== "boolean") return fail();
    return value;
  }
  if (/^u?int\d+$/.test(field.type)) {
    const bits = Number(field.type.replace(/^u?int/, "")),
      signed = field.type.startsWith("int");
    if (typeof value !== "string" || !/^(0|[1-9]\d*|-[1-9]\d*)$/.test(value)) return fail();
    const n = BigInt(value),
      range = 1n << BigInt(bits - (signed ? 1 : 0));
    if (n < (signed ? -range : 0n) || n >= range) return fail();
    return bits <= 48 ? Number(n) : n;
  }
  return fail();
}
function parameters(value: unknown, fields: readonly AbiParameter[]): Record<string, unknown> {
  const data = object(value);
  if (Object.keys(data).length !== fields.length) return fail();
  return Object.fromEntries(
    fields.map((field) => [field.name!, parameter(data[field.name!], field)])
  );
}
function boundary(value: unknown) {
  const b = object(value);
  return {
    blockNumber: uint(b.blockNumber),
    blockHash: hash(b.blockHash),
    digest: hash(b.digest),
    timestamp: uint(b.timestamp),
  };
}
function metadata(value: unknown) {
  const a = object(value);
  const text = (v: unknown) => {
    if (v === null) return null;
    if (typeof v !== "string") return fail();
    return v;
  };
  return {
    address: address(a.address),
    symbol: text(a.symbol),
    name: text(a.name),
    decimals: nullable(a.decimals, (v) => integer(v, 255)),
  };
}
export function parsePositionStatement(
  value: unknown,
  deploymentId: string,
  positionId: bigint,
  direction: "asc" | "desc" = "desc"
) {
  const body = object(value),
    history = object(body.historyStart),
    observed = boundary(body.observationBoundary);
  if (
    body.deploymentId !== deploymentId ||
    uint(body.positionId) !== positionId ||
    typeof history.openingObserved !== "boolean" ||
    !Array.isArray(body.items) ||
    body.items.length > 100
  )
    return fail();
  const firstBlock = uint(history.blockNumber);
  if (firstBlock > observed.blockNumber) return fail();
  const items = body.items.map((raw) => {
    const row = object(raw),
      name = row.eventName;
    if (typeof name !== "string" || !Object.hasOwn(statementCategories, name)) return fail();
    const eventName = name as StatementEventName,
      abi = staticsAbi.find((event) => event.type === "event" && event.name === eventName);
    if (
      !abi ||
      abi.type !== "event" ||
      row.category !== statementCategories[eventName] ||
      uint(row.positionId) !== positionId
    )
      return fail();
    const payload = parameters(row.payload, abi.inputs),
      payloadPosition = payload.positionId ?? payload.tokenId;
    if (payloadPosition !== positionId) return fail();
    const poolId = nullable(row.poolId, hash),
      posmTokenId = nullable(row.posmTokenId, uint),
      newPosmTokenId = nullable(row.newPosmTokenId, uint);
    if (
      poolId?.toLowerCase() !==
        (typeof payload.poolId === "string" ? payload.poolId.toLowerCase() : undefined) ||
      posmTokenId !== (payload.posmTokenId ?? payload.oldPosmTokenId ?? null) ||
      newPosmTokenId !== (payload.newPosmTokenId ?? null)
    )
      return fail();
    const transactionHash = hash(row.transactionHash),
      logIndex = integer(row.logIndex),
      blockNumber = uint(row.blockNumber),
      blockHash = hash(row.blockHash),
      timestamp = uint(row.timestamp);
    if (
      row.key !== `${deploymentId}:${transactionHash}:${logIndex}` ||
      blockNumber > observed.blockNumber ||
      blockNumber < firstBlock ||
      timestamp > observed.timestamp ||
      (blockNumber === observed.blockNumber && blockHash !== observed.blockHash)
    )
      return fail();
    if (!Array.isArray(row.movements)) return fail();
    const movements = row.movements.map((entry, index) => {
      const m = object(entry),
        ordinal = integer(m.ordinal),
        asset = metadata(m.asset),
        actor = nullable(m.actor, address),
        amount = uint(m.amount);
      if (
        ordinal !== index ||
        amount === 0n ||
        !["wallet", "internal", "entitlement"].includes(String(m.space)) ||
        !["debit", "credit"].includes(String(m.direction)) ||
        !purposes.includes(m.purpose as (typeof purposes)[number]) ||
        (m.space === "wallet" && (!actor || actor === zeroAddress)) ||
        (m.space !== "wallet" && actor !== null)
      )
        return fail();
      return {
        ordinal,
        asset,
        actor,
        amount,
        space: m.space as "wallet" | "internal" | "entitlement",
        direction: m.direction as "debit" | "credit",
        purpose: m.purpose as (typeof purposes)[number],
      };
    });
    const ownerBefore = nullable(row.ownerBefore, address),
      ownerAfter = nullable(row.ownerAfter, address);
    if (
      eventName === "Transfer" &&
      (payload.from !== ownerBefore ||
        payload.to !== ownerAfter ||
        payload.from === zeroAddress ||
        payload.to === zeroAddress)
    )
      return fail();
    if (eventName === "PositionClosed" && ownerAfter !== null) return fail();
    if (eventName === "PositionCreated" && payload.owner !== ownerAfter) return fail();
    if (eventName === "PositionGaugeAllocationsSet") {
      const pools = payload.poolIds as Hex[],
        amounts = payload.amounts as bigint[];
      if (
        pools.length !== amounts.length ||
        pools.length > 16 ||
        new Set(pools.map((p) => p.toLowerCase())).size !== pools.length ||
        amounts.some((a) => a <= 0n) ||
        amounts.reduce((a, b) => a + b, 0n) !== payload.totalAllocated
      )
        return fail();
    }
    return {
      key: row.key as string,
      category: statementCategories[eventName],
      positionId,
      transactionHash,
      logIndex,
      blockNumber,
      blockHash,
      timestamp,
      transactionSender: address(row.transactionSender),
      ownerBefore,
      ownerAfter,
      poolId,
      posmTokenId,
      newPosmTokenId,
      movements,
      ...({ eventName, payload } as StatementPayload),
    };
  });
  for (let i = 1; i < items.length; i++) {
    const previous = items[i - 1]!,
      current = items[i]!,
      cmp =
        previous.blockNumber === current.blockNumber
          ? previous.logIndex - current.logIndex
          : previous.blockNumber < current.blockNumber
            ? -1
            : 1;
    if (direction === "asc" ? cmp >= 0 : cmp <= 0) return fail();
  }
  const nextCursor = nullable(body.nextCursor, (v) => {
    if (typeof v !== "string" || v.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(v)) return fail();
    return v;
  });
  if (nextCursor && !items.length) return fail();
  return {
    deploymentId,
    positionId,
    historyStart: { blockNumber: firstBlock, openingObserved: history.openingObserved },
    observationBoundary: observed,
    items,
    nextCursor,
  };
}
export type PositionStatementPage = ReturnType<typeof parsePositionStatement>;
