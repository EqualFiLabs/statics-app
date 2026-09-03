import { ponder } from "ponder:registry";
import { genesisActivationRegistryAbi, staticsAbi } from "@statics-protocol/sdk";
import { staticsGenesisCreditAbi } from "@statics-protocol/sdk/genesis-credit";
import { getAddress, zeroAddress } from "viem";
import { activeGenesisCreditMutation } from "./genesis-credit";
import { genesisTransferMutation, genesisWeightChangedMutation } from "./genesis";
import { configuredAddress } from "./source-config";

import {
  activeGenesisCredit,
  activeLoan,
  genesisNft,
  genesisRewardClaim,
  harvestedFee,
  marketCandle,
  marketSwap,
  v4Position,
} from "ponder:schema";
import { absoluteAmount, candleBucket, marketCandleKey, marketSwapMetrics } from "./market";

const deploymentId = process.env.PONDER_DEPLOYMENT_ID?.trim();
if (!deploymentId) throw new Error("PONDER_DEPLOYMENT_ID is required.");
const entityKey = (id: bigint) => `${deploymentId}:${id}`;
const eventKey = (transactionHash: string, logIndex: number) =>
  `${deploymentId}:${transactionHash}:${logIndex}`;
const genesisVaultValue = process.env.PONDER_GENESIS_VAULT_ADDRESS?.trim();
const genesisVault = genesisVaultValue ? getAddress(genesisVaultValue) : undefined;

function sourceHandler(enabled: boolean): typeof ponder.on {
  return enabled ? (ponder.on.bind(ponder) as typeof ponder.on) : () => undefined;
}

const onStatics = sourceHandler(Boolean(configuredAddress("PONDER_STATICS_DIAMOND_ADDRESS")));
const onPositionManager = sourceHandler(
  Boolean(configuredAddress("PONDER_POSITION_MANAGER_ADDRESS"))
);
const onPoolManager = sourceHandler(Boolean(configuredAddress("PONDER_POOL_MANAGER_ADDRESS")));

onStatics("Statics:LoanOriginated", async ({ event, context }) => {
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

onStatics("Statics:LoanExtended", async ({ event, context }) => {
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

onStatics("Statics:LoanRepaid", async ({ event, context }) => {
  await context.db.delete(activeLoan, { key: entityKey(event.args.loanId) });
});

onStatics("Statics:LoanRecovered", async ({ event, context }) => {
  await context.db.delete(activeLoan, { key: entityKey(event.args.loanId) });
});

ponder.on("GenesisVault:GenesisCreditOpened", async ({ event, context }) => {
  const recoverableAt = await context.client.readContract({
    address: event.log.address,
    abi: staticsGenesisCreditAbi,
    functionName: "creditRecoverableAt",
    args: [event.args.genesisId],
    blockNumber: event.block.number,
  });
  const mutation = activeGenesisCreditMutation({
    type: "opened",
    deploymentId,
    genesisId: event.args.genesisId,
    owner: event.args.owner,
    principal: event.args.principal,
    maturity: BigInt(event.args.maturity),
    recoverableAt: BigInt(recoverableAt),
    blockNumber: event.block.number,
  });
  if (mutation.type === "insert") await context.db.insert(activeGenesisCredit).values(mutation.row);
});

ponder.on("GenesisVault:GenesisCreditExtended", async ({ event, context }) => {
  const recoverableAt = await context.client.readContract({
    address: event.log.address,
    abi: staticsGenesisCreditAbi,
    functionName: "creditRecoverableAt",
    args: [event.args.genesisId],
    blockNumber: event.block.number,
  });
  const mutation = activeGenesisCreditMutation({
    type: "extended",
    deploymentId,
    genesisId: event.args.genesisId,
    maturity: BigInt(event.args.newMaturity),
    recoverableAt: BigInt(recoverableAt),
    blockNumber: event.block.number,
  });
  if (mutation.type === "update") {
    await context.db.update(activeGenesisCredit, { key: mutation.key }).set(mutation.values);
  }
});

ponder.on("GenesisVault:GenesisCreditRepaid", async ({ event, context }) => {
  const mutation = activeGenesisCreditMutation({
    type: "repaid",
    deploymentId,
    genesisId: event.args.genesisId,
  });
  if (mutation.type === "delete")
    await context.db.delete(activeGenesisCredit, { key: mutation.key });
});

ponder.on("GenesisVault:GenesisCreditRecovered", async ({ event, context }) => {
  const mutation = activeGenesisCreditMutation({
    type: "recovered",
    deploymentId,
    genesisId: event.args.genesisId,
  });
  if (mutation.type === "delete")
    await context.db.delete(activeGenesisCredit, { key: mutation.key });
});

onPositionManager("PositionManager:Transfer", async ({ event, context }) => {
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

ponder.on("StaticsGenesis:Transfer", async ({ event, context }) => {
  const mutation = genesisTransferMutation({
    deploymentId,
    genesisId: event.args.tokenId,
    to: event.args.to,
    vault: genesisVault,
    blockNumber: event.block.number,
  });
  if (mutation.type === "delete") {
    await context.db.delete(genesisNft, { key: mutation.key });
    return;
  }
  await context.db.insert(genesisNft).values(mutation.row).onConflictDoUpdate(mutation.update);
});

onStatics("Statics:GenesisActivated", async ({ event, context }) => {
  await context.db.update(genesisNft, { key: entityKey(event.args.genesisId) }).set({
    tier: Number(event.args.newTier),
    multiplierBps: Number(event.args.multiplierBps),
    updatedAtBlock: event.block.number,
  });
});

onStatics("Statics:GenesisLinked", async ({ event, context }) => {
  await context.db.update(genesisNft, { key: entityKey(event.args.genesisId) }).set({
    linkedPositionId: event.args.positionId,
    updatedAtBlock: event.block.number,
  });
});

onStatics("Statics:GenesisUnlinked", async ({ event, context }) => {
  await context.db.update(genesisNft, { key: entityKey(event.args.genesisId) }).set({
    linkedPositionId: 0n,
    updatedAtBlock: event.block.number,
  });
});

onStatics("Statics:GenesisActivationReset", async ({ event, context }) => {
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
  if (!genesisVault)
    throw new Error("PONDER_GENESIS_VAULT_ADDRESS is required for Genesis weights.");
  const mutation = genesisWeightChangedMutation({
    deploymentId,
    genesisId: event.args.genesisId,
    vault: genesisVault,
    newWeight: event.args.newWeight,
    blockNumber: event.block.number,
  });
  await context.db.insert(genesisNft).values(mutation.row).onConflictDoUpdate(mutation.update);
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

onPoolManager("PoolManager:Swap", async ({ event, context }) => {
  const metrics = marketSwapMetrics(event.args.amount0, event.args.amount1);
  await context.db.insert(marketSwap).values({
    key: eventKey(event.transaction.hash, event.log.logIndex),
    deploymentId,
    poolId: event.args.id,
    sender: getAddress(event.args.sender),
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    volume0: metrics.volume0,
    volume1: metrics.volume1,
    price1Per0Wad: metrics.price1Per0Wad,
    sqrtPriceX96: event.args.sqrtPriceX96,
    liquidity: event.args.liquidity,
    tick: event.args.tick,
    fee: event.args.fee,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    logIndex: event.log.logIndex,
  });

  const bucketTimestamp = candleBucket(event.block.timestamp);
  const sqrtPriceX96 = event.args.sqrtPriceX96;
  await context.db
    .insert(marketCandle)
    .values({
      key: marketCandleKey(deploymentId, event.args.id, event.block.timestamp),
      deploymentId,
      poolId: event.args.id,
      bucketTimestamp,
      openSqrtPriceX96: sqrtPriceX96,
      highSqrtPriceX96: sqrtPriceX96,
      lowSqrtPriceX96: sqrtPriceX96,
      closeSqrtPriceX96: sqrtPriceX96,
      volume0: absoluteAmount(event.args.amount0),
      volume1: absoluteAmount(event.args.amount1),
      zeroForOneCount: event.args.amount0 > 0n ? 1 : 0,
      oneForZeroCount: event.args.amount0 > 0n ? 0 : 1,
      swapCount: 1,
      firstBlock: event.block.number,
      lastBlock: event.block.number,
    })
    .onConflictDoUpdate((row) => ({
      highSqrtPriceX96: row.highSqrtPriceX96 > sqrtPriceX96 ? row.highSqrtPriceX96 : sqrtPriceX96,
      lowSqrtPriceX96: row.lowSqrtPriceX96 < sqrtPriceX96 ? row.lowSqrtPriceX96 : sqrtPriceX96,
      closeSqrtPriceX96: sqrtPriceX96,
      volume0: row.volume0 + absoluteAmount(event.args.amount0),
      volume1: row.volume1 + absoluteAmount(event.args.amount1),
      zeroForOneCount: row.zeroForOneCount + (event.args.amount0 > 0n ? 1 : 0),
      oneForZeroCount: row.oneForZeroCount + (event.args.amount0 > 0n ? 0 : 1),
      swapCount: row.swapCount + 1,
      lastBlock: event.block.number,
    }));
});
