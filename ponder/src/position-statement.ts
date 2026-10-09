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
import { statementMovements } from "../../lib/indexer/statement-movements";

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
        ? previous
          ? previous.owner
          : getAddress(a.owner as string)
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
  let stakingAsset: Address | null = null;
  if (name === "Staked" || name === "Unstaked") {
    let config = await context.db.find(positionStatementConfig, { key: deploymentId });
    if (!config) {
      const asset = getAddress(
        await context.client.readContract({
          address: event.log.address,
          abi: staticsAbi,
          functionName: "stakingToken",
          blockNumber: event.block.number,
        })
      );
      config = await context.db
        .insert(positionStatementConfig)
        .values({ key: deploymentId, stakingAsset: asset });
    }
    stakingAsset = config.stakingAsset;
  }
  let poolCurrencies: readonly Address[] | null = null;
  if (name.startsWith("ManagedLiquidity")) {
    const pool = await context.db.find(publicPool, {
      key: `${deploymentId}:${poolId!.toLowerCase()}`,
    });
    if (!pool) throw new Error(`Missing indexed PoolKey for statement ${statementKey}`);
    poolCurrencies = [pool.currency0, pool.currency1];
  }
  const movements = statementMovements(name, a, { stakingAsset, poolCurrencies });
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
