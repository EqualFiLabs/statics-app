import type { ponder } from "ponder:registry";
import {
  getAddress,
  keccak256,
  stringToHex,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from "viem";
import { staticsAbi } from "@statics-protocol/sdk/phase-one";
import {
  positionStatement,
  positionStatementMovement,
  positionStatementHistory,
  positionStatementBlock,
  positionStatementConfig,
  positionStatementRevision,
  publicPool,
} from "ponder:schema";
import { readTokenMetadata } from "./allocation-snapshots";

import { statementCategories, type StatementEventName } from "../../lib/indexer/position-statement";
export { statementCategories } from "../../lib/indexer/position-statement";
type Context = Parameters<Parameters<typeof ponder.on>[1]>[0]["context"];
type Event = {
  args: Record<string, unknown>;
  transaction: { hash: Hex; from: Address };
  log: { logIndex: number; address: Address };
  block: { number: bigint; timestamp: bigint; hash: Hex };
};
export function statementJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "bigint" || typeof item === "number" ? String(item) : item
  );
}
type Movement = {
  asset: Address;
  space: "wallet" | "internal" | "entitlement";
  direction: "debit" | "credit";
  purpose: string;
  actor: Address | null;
  amount: bigint;
};

export async function recordPositionStatement(
  deploymentId: string,
  name: string,
  event: Event,
  context: Context
) {
  if (!(name in statementCategories)) return;
  const eventName = name as StatementEventName;
  const a = event.args;
  const id = (name === "Transfer" ? a.tokenId : a.positionId) as bigint;
  const key = `${deploymentId}:${id}`;
  const previous = await context.db.find(positionStatementHistory, { key });
  const from = name === "Transfer" ? getAddress(a.from as string) : null;
  const to = name === "Transfer" ? getAddress(a.to as string) : null;
  const opening = name === "PositionCreated" || from === zeroAddress;
  const owner =
    name === "Transfer"
      ? to === zeroAddress
        ? null
        : to
      : name === "PositionCreated"
        ? getAddress(a.owner as string)
        : name === "PositionClosed"
          ? null
          : (previous?.owner ?? null);
  const ownerBefore =
    name === "PositionCreated"
      ? null
      : name === "Transfer"
        ? from === zeroAddress
          ? null
          : from
        : (previous?.owner ?? previous?.lastOwner ?? null);
  await context.db
    .insert(positionStatementHistory)
    .values({
      key,
      deploymentId,
      positionId: id,
      owner,
      lastOwner: owner ?? ownerBefore,
      firstBlock: event.block.number,
      openingObserved: opening,
    })
    .onConflictDoUpdate({
      owner,
      lastOwner: owner ?? ownerBefore,
      openingObserved: opening || (previous?.openingObserved ?? false),
    });
  // Mint/burn establish ownership but lifecycle events describe opening/closing exactly once.
  const lifecycleOnly = name === "Transfer" && (from === zeroAddress || to === zeroAddress);
  const blockKey = `${deploymentId}:${event.block.number}`;
  const revision = await context.db.find(positionStatementRevision, { key: deploymentId });
  const digest = keccak256(
    stringToHex(
      `${revision?.digest ?? zeroHash}:${event.transaction.hash}:${event.log.logIndex}:${name}:${statementJson(a)}`
    )
  );
  await context.db
    .insert(positionStatementRevision)
    .values({ key: deploymentId, digest })
    .onConflictDoUpdate({ digest });
  await context.db
    .insert(positionStatementBlock)
    .values({
      key: blockKey,
      deploymentId,
      blockNumber: event.block.number,
      blockHash: event.block.hash,
      blockTimestamp: event.block.timestamp,
      digest,
    })
    .onConflictDoUpdate({ digest });
  if (lifecycleOnly) return;
  const statementKey = `${deploymentId}:${event.transaction.hash}:${event.log.logIndex}`;
  const poolId = typeof a.poolId === "string" ? (a.poolId as Hex) : null;
  const movements: Movement[] = [];
  function move(
    asset: Address,
    space: Movement["space"],
    direction: Movement["direction"],
    purpose: string,
    amount: unknown,
    actor: Address | null = null
  ) {
    const quantity = BigInt(amount as bigint | string);
    if (quantity > 0n)
      movements.push({
        asset: getAddress(asset),
        space,
        direction,
        purpose,
        actor,
        amount: quantity,
      });
  }
  if (name === "Staked" || name === "Unstaked") {
    let config = await context.db.find(positionStatementConfig, { key: deploymentId });
    if (!config) {
      const stakingAsset = getAddress(
        await context.client.readContract({
          address: event.log.address as Address,
          abi: staticsAbi,
          functionName: "stakingToken",
          blockNumber: event.block.number,
        })
      );
      config = await context.db
        .insert(positionStatementConfig)
        .values({ key: deploymentId, stakingAsset });
    }
    move(
      config.stakingAsset,
      "wallet",
      name === "Staked" ? "debit" : "credit",
      name === "Staked" ? "stake" : "unstake",
      a.amount,
      getAddress((a.payer ?? a.receiver) as string)
    );
  }
  if (name === "PositionCreationFeePaid") {
    // The event proves the treasury receipt, not the original payer of a wrapped wallet call.
    move(
      zeroAddress,
      "wallet",
      "credit",
      "creation-fee",
      a.amount,
      getAddress(a.treasury as string)
    );
  }
  if (name.startsWith("ManagedLiquidity") && name !== "ManagedLiquidityAttached") {
    const pool = await context.db.find(publicPool, {
      key: `${deploymentId}:${poolId!.toLowerCase()}`,
    });
    if (!pool) throw new Error(`Missing indexed PoolKey for statement ${statementKey}`);
    const currencies = [pool.currency0, pool.currency1] as const;
    if (name === "ManagedLiquidityFeesCollected")
      currencies.forEach((asset, i) =>
        move(
          asset,
          "wallet",
          "credit",
          "trading-fees",
          a[`amount${i}`],
          getAddress(a.receiver as string)
        )
      );
    else {
      const m = a.movement as {
        payer: Address;
        receiver: Address;
        paid0: bigint;
        paid1: bigint;
        received0: bigint;
        received1: bigint;
      };
      currencies.forEach((asset, i) => {
        move(
          asset,
          "wallet",
          "debit",
          "liquidity-funding",
          m[i === 0 ? "paid0" : "paid1"],
          m.payer
        );
        move(
          asset,
          "wallet",
          "credit",
          name === "ManagedLiquidityProvided" ||
            name === "ManagedLiquidityRebalanced" ||
            m.payer !== zeroAddress
            ? "liquidity-refund"
            : "liquidity-output",
          m[i === 0 ? "received0" : "received1"],
          m.receiver
        );
      });
      if (name === "ManagedLiquidityRebalanced") {
        const s = a.settlement as Record<string, bigint>;
        currencies.forEach((asset, i) => {
          move(asset, "internal", "credit", "rebalance-withdrawal", s[`withdrawn${i}`]);
          move(asset, "internal", "debit", "rebalance-mint-spend", s[`mintSpent${i}`]);
          move(asset, "internal", "credit", "rebalance-mint-return", s[`mintReceived${i}`]);
        });
      }
    }
  }
  if (
    name === "RewardClaimed" ||
    name === "LpRewardsClaimed" ||
    name === "GaugeAllocatorRewardClaimed"
  ) {
    move(a.asset as Address, "internal", "debit", "reward-payout-debit", a.debited);
    move(
      a.asset as Address,
      "wallet",
      "credit",
      "reward-payout",
      a.received,
      getAddress(a.receiver as string)
    );
  }
  if (name === "PositionRewardSettled")
    move(a.asset as Address, "entitlement", "credit", "reward-settlement", a.amount);
  if (name === "LpRewardForfeited" || name === "GaugeAllocatorRewardForfeited")
    move(a.asset as Address, "entitlement", "debit", "reward-forfeiture", a.amount);
  if (typeof a.asset === "string") await readTokenMetadata(context, event, getAddress(a.asset));
  await context.db.insert(positionStatement).values({
    key: statementKey,
    deploymentId,
    positionId: id,
    eventName,
    category: statementCategories[eventName],
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    blockNumber: event.block.number,
    blockHash: event.block.hash,
    blockTimestamp: event.block.timestamp,
    transactionSender: getAddress(event.transaction.from),
    ownerBefore,
    ownerAfter: name === "PositionClosed" ? null : owner,
    poolId,
    posmTokenId: (a.posmTokenId ?? a.oldPosmTokenId ?? null) as bigint | null,
    newPosmTokenId: (a.newPosmTokenId ?? null) as bigint | null,
    payloadJson: statementJson(a),
  });
  // Bounded by this event's movements. Metadata cache serves currencies and reward tokens alike.
  for (const [ordinal, movement] of movements.entries()) {
    await readTokenMetadata(context, event, movement.asset);
    await context.db.insert(positionStatementMovement).values({
      key: `${statementKey}:${ordinal}`,
      statementKey,
      ordinal,
      chainId: context.chain.id,
      ...movement,
    });
  }
}
