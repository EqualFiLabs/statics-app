import { ponder } from "ponder:registry";
import { genesisActivationRegistryAbi, staticsAbi } from "@statics-protocol/sdk";
import { getAddress, zeroAddress } from "viem";

import {
  activeLoan,
  genesisNft,
  genesisRewardClaim,
  harvestedFee,
  marketSwap,
  v4Position,
} from "ponder:schema";

const deploymentId = process.env.PONDER_DEPLOYMENT_ID?.trim();
if (!deploymentId) throw new Error("PONDER_DEPLOYMENT_ID is required.");
const entityKey = (id: bigint) => `${deploymentId}:${id}`;
const eventKey = (transactionHash: string, logIndex: number) =>
  `${deploymentId}:${transactionHash}:${logIndex}`;
const canonicalPoolId = process.env.PONDER_CANONICAL_POOL_ID?.trim().toLowerCase();

ponder.on("Statics:LoanOriginated", async ({ event, context }) => {
  const maturity = BigInt(event.args.maturity);
  const recoveryGracePeriod = await context.client.readContract({
    address: event.log.address,
    abi: staticsAbi,
    functionName: "recoveryGracePeriod",
    blockNumber: event.block.number,
  });
  await context.db.insert(activeLoan).values({
    key: entityKey(event.args.loanId),
    deploymentId,
    id: event.args.loanId,
    positionId: event.args.positionId,
    basketId: event.args.basketId,
    maturity,
    recoverableAt: maturity + recoveryGracePeriod,
    updatedAtBlock: event.block.number,
  });
});

ponder.on("Statics:LoanExtended", async ({ event, context }) => {
  const maturity = BigInt(event.args.maturity);
  const recoveryGracePeriod = await context.client.readContract({
    address: event.log.address,
    abi: staticsAbi,
    functionName: "recoveryGracePeriod",
    blockNumber: event.block.number,
  });
  await context.db.update(activeLoan, { key: entityKey(event.args.loanId) }).set({
    maturity,
    recoverableAt: maturity + recoveryGracePeriod,
    updatedAtBlock: event.block.number,
  });
});

ponder.on("Statics:LoanRepaid", async ({ event, context }) => {
  await context.db.delete(activeLoan, { key: entityKey(event.args.loanId) });
});

ponder.on("Statics:LoanRecovered", async ({ event, context }) => {
  await context.db.delete(activeLoan, { key: entityKey(event.args.loanId) });
});

ponder.on("PositionManager:Transfer", async ({ event, context }) => {
  const key = entityKey(event.args.tokenId);
  if (event.args.to === zeroAddress) {
    await context.db.delete(v4Position, { key });
    return;
  }
  await context.db
    .insert(v4Position)
    .values({
      key,
      deploymentId,
      id: event.args.tokenId,
      owner: getAddress(event.args.to),
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({
      owner: getAddress(event.args.to),
      updatedAtBlock: event.block.number,
    });
});

ponder.on("StaticsGenesis:ConsecutiveTransfer", async ({ event, context }) => {
  const owner = getAddress(event.args.toAddress);
  const batchSize = 500n;
  for (let start = event.args.fromTokenId; start <= event.args.toTokenId; start += batchSize) {
    const end = start + batchSize - 1n;
    const cappedEnd = end < event.args.toTokenId ? end : event.args.toTokenId;
    const values = [];
    for (let id = start; id <= cappedEnd; id += 1n) {
      values.push({
        key: entityKey(id),
        deploymentId,
        id,
        owner,
        tier: 0,
        multiplierBps: 10_000,
        linkedPositionId: 0n,
        registered: false,
        effectiveWeight: 0n,
        updatedAtBlock: event.block.number,
      });
    }
    await context.db.insert(genesisNft).values(values);
  }
});

ponder.on("StaticsGenesis:Transfer", async ({ event, context }) => {
  const key = entityKey(event.args.tokenId);
  if (event.args.to === zeroAddress) {
    await context.db.delete(genesisNft, { key });
    return;
  }
  await context.db
    .insert(genesisNft)
    .values({
      key,
      deploymentId,
      id: event.args.tokenId,
      owner: getAddress(event.args.to),
      tier: 0,
      multiplierBps: 10_000,
      linkedPositionId: 0n,
      registered: false,
      effectiveWeight: 0n,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({
      owner: getAddress(event.args.to),
      tier: 0,
      multiplierBps: 10_000,
      linkedPositionId: 0n,
      updatedAtBlock: event.block.number,
    });
});

ponder.on("Statics:GenesisActivated", async ({ event, context }) => {
  await context.db.update(genesisNft, { key: entityKey(event.args.genesisId) }).set({
    tier: Number(event.args.newTier),
    multiplierBps: Number(event.args.multiplierBps),
    updatedAtBlock: event.block.number,
  });
});

ponder.on("Statics:GenesisLinked", async ({ event, context }) => {
  await context.db.update(genesisNft, { key: entityKey(event.args.genesisId) }).set({
    linkedPositionId: event.args.positionId,
    updatedAtBlock: event.block.number,
  });
});

ponder.on("Statics:GenesisUnlinked", async ({ event, context }) => {
  await context.db.update(genesisNft, { key: entityKey(event.args.genesisId) }).set({
    linkedPositionId: 0n,
    updatedAtBlock: event.block.number,
  });
});

ponder.on("Statics:GenesisActivationReset", async ({ event, context }) => {
  await context.db.update(genesisNft, { key: entityKey(event.args.genesisId) }).set({
    tier: 0,
    multiplierBps: 10_000,
    linkedPositionId: 0n,
    updatedAtBlock: event.block.number,
  });
});

ponder.on("GenesisActivationRegistry:GenesisActivated", async ({ event, context }) => {
  const multiplierBps = await context.client.readContract({
    address: event.log.address,
    abi: genesisActivationRegistryAbi,
    functionName: "multiplierBps",
    args: [event.args.genesisId],
    blockNumber: event.block.number,
  });
  await context.db.update(genesisNft, { key: entityKey(event.args.genesisId) }).set({
    tier: Number(event.args.newTier),
    multiplierBps: Number(multiplierBps),
    updatedAtBlock: event.block.number,
  });
});

ponder.on("GenesisActivationRegistry:GenesisActivationReset", async ({ event, context }) => {
  await context.db.update(genesisNft, { key: entityKey(event.args.genesisId) }).set({
    tier: 0,
    multiplierBps: 10_000,
    updatedAtBlock: event.block.number,
  });
});

ponder.on("GenesisLaunchDistributor:GenesisRegistered", async ({ event, context }) => {
  await context.db.update(genesisNft, { key: entityKey(event.args.genesisId) }).set({
    registered: true,
    effectiveWeight: event.args.weight,
    updatedAtBlock: event.block.number,
  });
});

ponder.on("GenesisLaunchDistributor:GenesisWeightChanged", async ({ event, context }) => {
  await context.db.update(genesisNft, { key: entityKey(event.args.genesisId) }).set({
    effectiveWeight: event.args.newWeight,
    updatedAtBlock: event.block.number,
  });
});

ponder.on("GenesisLaunchDistributor:GenesisRewardsClaimed", async ({ event, context }) => {
  await context.db.insert(genesisRewardClaim).values({
    key: eventKey(event.transaction.hash, event.log.logIndex),
    deploymentId,
    genesisId: event.args.genesisId,
    owner: getAddress(event.args.owner),
    asset: getAddress(event.args.asset),
    amount: event.args.amount,
    previousOwnerClaim: false,
    blockNumber: event.block.number,
  });
});

ponder.on("GenesisLaunchDistributor:OwnerRewardsClaimed", async ({ event, context }) => {
  await context.db.insert(genesisRewardClaim).values({
    key: eventKey(event.transaction.hash, event.log.logIndex),
    deploymentId,
    genesisId: null,
    owner: getAddress(event.args.owner),
    asset: getAddress(event.args.asset),
    amount: event.args.amount,
    previousOwnerClaim: true,
    blockNumber: event.block.number,
  });
});

ponder.on("StaticsFeeReceiver:FeesHarvested", async ({ event, context }) => {
  await context.db.insert(harvestedFee).values({
    key: eventKey(event.transaction.hash, event.log.logIndex),
    deploymentId,
    distributor: getAddress(event.args.distributor),
    asset: getAddress(event.args.asset),
    amount: event.args.amount,
    cumulativeAmount: event.args.cumulativeAmount,
    blockNumber: event.block.number,
  });
});

ponder.on("PoolManager:Swap", async ({ event, context }) => {
  if (!canonicalPoolId || event.args.id.toLowerCase() !== canonicalPoolId) return;
  await context.db.insert(marketSwap).values({
    key: eventKey(event.transaction.hash, event.log.logIndex),
    deploymentId,
    poolId: event.args.id,
    sender: getAddress(event.args.sender),
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    sqrtPriceX96: event.args.sqrtPriceX96,
    liquidity: event.args.liquidity,
    tick: event.args.tick,
    fee: event.args.fee,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
});
