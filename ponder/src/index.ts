import { ponder } from "ponder:registry";
import {
  genesisActivationRegistryAbi,
  staticsAbi as legacyStaticsAbi,
} from "@statics-protocol/sdk";
import { staticsGenesisCreditAbi } from "@statics-protocol/sdk/genesis-credit";
import {
  staticsAbi as phaseOneStaticsAbi,
  staticsGaugeIncentivesAbi,
  staticsMarketTapeAbi,
} from "@statics-protocol/sdk/phase-one";
import { getAddress, zeroAddress, type Hex } from "viem";
import { activeGenesisCreditMutation } from "./genesis-credit";
import {
  genesisConsecutiveTransferMutations,
  genesisTransferMutation,
  genesisWeightChangedMutation,
} from "./genesis";
import { configuredAddress } from "./source-config";

import {
  activeGenesisCredit,
  activeLoan,
  genesisNft,
  genesisRewardClaim,
  harvestedFee,
  marketCandle,
  marketSwap,
  gaugePeriod,
  gaugePoolState,
  gaugeReserveState,
  managedGaugePosition,
  phaseOneActivity,
  phaseOneMarketObservation,
  phaseOneMarketSwap,
  poolRewardSlot,
  positionGaugeState,
  positionNft,
  publicPool,
  rewardRestriction,
  v4Position,
} from "ponder:schema";
import { absoluteAmount, candleBucket, marketCandleKey, marketSwapMetrics } from "./market";
import {
  allocationSnapshotJson,
  normalizeGaugeAllocationSnapshot,
  phaseOneEntityKey,
  phaseOneMinuteCandle,
  mergeMinuteCandle,
  unpackBalanceDelta,
  unpackUint128Pair,
} from "./phase-one";

const deploymentId = process.env.PONDER_DEPLOYMENT_ID?.trim();
if (!deploymentId) throw new Error("PONDER_DEPLOYMENT_ID is required.");
const phaseOneDeploymentId = process.env.PONDER_PHASE_ONE_DEPLOYMENT_ID?.trim();
const publicHookAddress = configuredAddress("PONDER_PUBLIC_HOOK_ADDRESS");
const phaseOneDiamondAddress = configuredAddress("PONDER_STATICS_DIAMOND_ADDRESS");
if (publicHookAddress && !phaseOneDeploymentId) {
  throw new Error("PONDER_PHASE_ONE_DEPLOYMENT_ID is required with PONDER_PUBLIC_HOOK_ADDRESS.");
}
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
const onPhaseOne = sourceHandler(Boolean(phaseOneDeploymentId && phaseOneDiamondAddress));
const onPublicHook = sourceHandler(Boolean(phaseOneDeploymentId && publicHookAddress));

const phaseOneKey = (...parts: readonly (string | bigint)[]) =>
  phaseOneEntityKey(phaseOneDeploymentId!, ...parts);
const phaseOneEventKey = (transactionHash: string, logIndex: number) =>
  phaseOneKey(transactionHash, BigInt(logIndex));

function rewardSlotKey(poolId: Hex, slot: number): string {
  return phaseOneKey(poolId.toLowerCase(), BigInt(slot));
}

function managedPositionKey(positionId: bigint, poolId: Hex): string {
  return phaseOneKey(positionId, poolId.toLowerCase());
}

onStatics("Statics:LoanOriginated", async ({ event, context }) => {
  const maturity = BigInt(event.args.maturity);
  const recoveryGracePeriod = await context.client.readContract({
    address: event.log.address,
    abi: legacyStaticsAbi,
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
    abi: legacyStaticsAbi,
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

ponder.on("StaticsGenesis:ConsecutiveTransfer", async ({ event, context }) => {
  const mutations = genesisConsecutiveTransferMutations({
    deploymentId,
    fromTokenId: event.args.fromTokenId,
    toTokenId: event.args.toTokenId,
    from: event.args.fromAddress,
    to: event.args.toAddress,
    vault: genesisVault,
    blockNumber: event.block.number,
  });
  for (const mutation of mutations) {
    if (mutation.type === "delete") {
      await context.db.delete(genesisNft, { key: mutation.key });
    } else {
      await context.db.insert(genesisNft).values(mutation.row).onConflictDoUpdate(mutation.update);
    }
  }
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

onPhaseOne("PhaseOneStatics:ProtocolPoolCreated", async ({ event, context }) => {
  if (!publicHookAddress) throw new Error("Public hook address is required for public pools.");
  const feeRate = await context.client.readContract({
    address: event.log.address,
    abi: phaseOneStaticsAbi,
    functionName: "protocolPoolFeeRate",
    args: [event.args.poolId],
    blockNumber: event.block.number,
  });
  await context.db
    .insert(publicPool)
    .values({
      key: phaseOneKey(event.args.poolId),
      deploymentId: phaseOneDeploymentId!,
      poolId: event.args.poolId,
      creator: getAddress(event.args.creator),
      currency0: getAddress(event.args.currency0),
      currency1: getAddress(event.args.currency1),
      hook: publicHookAddress,
      lpFee: event.args.lpFee,
      tickSpacing: event.args.tickSpacing,
      initialSqrtPriceX96: event.args.sqrtPriceX96,
      initialTick: event.args.tick,
      inputFeeBps: feeRate.inputFeeBps,
      outputFeeBps: feeRate.outputFeeBps,
      feeRateOverridden: feeRate.overridden,
      quarantined: false,
      decommissioned: false,
      polActivated: false,
      createdAtBlock: event.block.number,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({
      creator: getAddress(event.args.creator),
      currency0: getAddress(event.args.currency0),
      currency1: getAddress(event.args.currency1),
      hook: publicHookAddress,
      lpFee: event.args.lpFee,
      tickSpacing: event.args.tickSpacing,
      initialSqrtPriceX96: event.args.sqrtPriceX96,
      initialTick: event.args.tick,
      inputFeeBps: feeRate.inputFeeBps,
      outputFeeBps: feeRate.outputFeeBps,
      feeRateOverridden: feeRate.overridden,
      updatedAtBlock: event.block.number,
    });
});

onPhaseOne("PhaseOneStatics:ProtocolPolActivated", async ({ event, context }) => {
  await context.db.update(publicPool, { key: phaseOneKey(event.args.poolId) }).set({
    polActivated: true,
    updatedAtBlock: event.block.number,
  });
});

onPublicHook("PublicHook:PoolFeeRateSet", async ({ event, context }) => {
  if (!phaseOneDiamondAddress || !publicHookAddress) {
    throw new Error("Phase 1 addresses are required for public pool fee indexing.");
  }
  const pool = await context.client.readContract({
    address: phaseOneDiamondAddress,
    abi: phaseOneStaticsAbi,
    functionName: "protocolPool",
    args: [event.args.poolId],
    blockNumber: event.block.number,
  });
  await context.db
    .insert(publicPool)
    .values({
      key: phaseOneKey(event.args.poolId),
      deploymentId: phaseOneDeploymentId!,
      poolId: event.args.poolId,
      creator: getAddress(pool.creator),
      currency0: getAddress(pool.key.currency0),
      currency1: getAddress(pool.key.currency1),
      hook: publicHookAddress,
      lpFee: pool.key.fee,
      tickSpacing: pool.key.tickSpacing,
      initialSqrtPriceX96: 0n,
      initialTick: 0,
      inputFeeBps: event.args.inputFeeBps,
      outputFeeBps: event.args.outputFeeBps,
      feeRateOverridden: event.args.overridden,
      quarantined: false,
      decommissioned: pool.decommissioned,
      polActivated: pool.polActivated,
      createdAtBlock: event.block.number,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({
      inputFeeBps: event.args.inputFeeBps,
      outputFeeBps: event.args.outputFeeBps,
      feeRateOverridden: event.args.overridden,
      updatedAtBlock: event.block.number,
    });
});

onPublicHook("PublicHook:PoolDecommissioned", async ({ event, context }) => {
  await context.db.update(publicPool, { key: phaseOneKey(event.args.poolId) }).set({
    decommissioned: true,
    updatedAtBlock: event.block.number,
  });
});

onPhaseOne("PhaseOneStatics:ProtocolPoolQuarantineSet", async ({ event, context }) => {
  await context.db.update(publicPool, { key: phaseOneKey(event.args.poolId) }).set({
    quarantined: event.args.quarantined,
    updatedAtBlock: event.block.number,
  });
});

onPhaseOne("PhaseOneStatics:RewardRestrictionAdded", async ({ event, context }) => {
  const asset = getAddress(event.args.asset);
  await context.db
    .insert(rewardRestriction)
    .values({
      key: phaseOneKey(asset.toLowerCase()),
      deploymentId: phaseOneDeploymentId!,
      asset,
      restricted: true,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({ restricted: true, updatedAtBlock: event.block.number });
});

onPhaseOne("PhaseOneStatics:RewardRestrictionRemoved", async ({ event, context }) => {
  const asset = getAddress(event.args.asset);
  await context.db
    .insert(rewardRestriction)
    .values({
      key: phaseOneKey(asset.toLowerCase()),
      deploymentId: phaseOneDeploymentId!,
      asset,
      restricted: false,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({ restricted: false, updatedAtBlock: event.block.number });
});

onPhaseOne("PhaseOneStatics:MarketSwapRecorded", async ({ event, context }) => {
  const delta = unpackBalanceDelta(event.args.poolDelta);
  const fees = unpackUint128Pair(event.args.staticsFeesPacked);
  await context.db.insert(phaseOneMarketSwap).values({
    key: phaseOneEventKey(event.transaction.hash, event.log.logIndex),
    deploymentId: phaseOneDeploymentId!,
    poolId: event.args.poolId,
    sequence: event.args.sequence,
    amount0: delta.amount0,
    amount1: delta.amount1,
    staticsFee0: fees.amount0,
    staticsFee1: fees.amount1,
    finalTick: event.args.finalTick,
    nativeLpFee: event.args.nativeLpFee,
    flags: event.args.flags,
    internal: (event.args.flags & 4) !== 0,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    logIndex: event.log.logIndex,
  });
  const minute = phaseOneMinuteCandle({
    ...delta,
    finalTick: event.args.finalTick,
    flags: event.args.flags,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
  if (minute)
    await context.db
      .insert(marketCandle)
      .values({
        ...minute,
        key: marketCandleKey(phaseOneDeploymentId!, event.args.poolId, event.block.timestamp),
        deploymentId: phaseOneDeploymentId!,
        poolId: event.args.poolId,
      })
      .onConflictDoUpdate((row) => mergeMinuteCandle(row, minute));
});

onPhaseOne("PhaseOneStatics:MarketObservationCommitted", async ({ event, context }) => {
  const observation = await context.client.readContract({
    address: event.log.address,
    abi: staticsMarketTapeAbi,
    functionName: "marketObservation",
    args: [event.args.poolId, event.args.observationId],
    blockNumber: event.block.number,
  });
  await context.db.insert(phaseOneMarketObservation).values({
    key: phaseOneKey(event.args.poolId, event.args.observationId),
    deploymentId: phaseOneDeploymentId!,
    poolId: event.args.poolId,
    observationId: event.args.observationId,
    sequence: observation.sequence,
    timestamp: BigInt(observation.timestamp),
    tick: observation.tick,
    nativeLpFee: observation.nativeLpFee,
    flags: observation.flags,
    tickCumulative: observation.tickCumulative,
    externalVolume0: observation.externalVolume0,
    externalVolume1: observation.externalVolume1,
    internalVolume0: observation.internalVolume0,
    internalVolume1: observation.internalVolume1,
    staticsFees0: observation.staticsFees0,
    staticsFees1: observation.staticsFees1,
    externalSwapCount: observation.externalSwapCount,
    internalSwapCount: observation.internalSwapCount,
    blockNumber: event.block.number,
  });
});

onPhaseOne("PhaseOneStatics:PositionCreated", async ({ event, context }) => {
  await context.db
    .insert(positionNft)
    .values({
      key: phaseOneKey(event.args.positionId),
      deploymentId: phaseOneDeploymentId!,
      positionId: event.args.positionId,
      owner: getAddress(event.args.owner),
      stakedBalance: 0n,
      activeLegCount: 0n,
      unresolvedObligationCount: 0n,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({
      owner: getAddress(event.args.owner),
      updatedAtBlock: event.block.number,
    });
});

onPhaseOne("PhaseOneStatics:Transfer", async ({ event, context }) => {
  const key = phaseOneKey(event.args.tokenId);
  if (event.args.to === zeroAddress) {
    await context.db.delete(positionNft, { key });
    return;
  }
  await context.db
    .insert(positionNft)
    .values({
      key,
      deploymentId: phaseOneDeploymentId!,
      positionId: event.args.tokenId,
      owner: getAddress(event.args.to),
      stakedBalance: 0n,
      activeLegCount: 0n,
      unresolvedObligationCount: 0n,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({
      owner: getAddress(event.args.to),
      updatedAtBlock: event.block.number,
    });
});

onPhaseOne("PhaseOneStatics:Staked", async ({ event, context }) => {
  await context.db.update(positionNft, { key: phaseOneKey(event.args.positionId) }).set({
    stakedBalance: event.args.totalPositionStake,
    updatedAtBlock: event.block.number,
  });
});

onPhaseOne("PhaseOneStatics:Unstaked", async ({ event, context }) => {
  await context.db.update(positionNft, { key: phaseOneKey(event.args.positionId) }).set({
    stakedBalance: event.args.totalPositionStake,
    updatedAtBlock: event.block.number,
  });
});

onPhaseOne("PhaseOneStatics:PositionStateChanged", async ({ event, context }) => {
  await context.db.update(positionNft, { key: phaseOneKey(event.args.tokenId) }).set({
    activeLegCount: event.args.activeLegCount,
    unresolvedObligationCount: event.args.unresolvedObligationCount,
    updatedAtBlock: event.block.number,
  });
});

for (const eventName of ["ManagedLiquidityProvided", "ManagedLiquidityAttached"] as const) {
  onPhaseOne(`PhaseOneStatics:${eventName}`, async ({ event, context }) => {
    const state = {
      posmTokenId: event.args.posmTokenId,
      manager: getAddress(event.args.manager),
      tickLower: event.args.tickLower,
      tickUpper: event.args.tickUpper,
      liquidity: event.args.liquidity,
      active: true,
      updatedAtBlock: event.block.number,
    };
    await context.db
      .insert(managedGaugePosition)
      .values({
        key: managedPositionKey(event.args.positionId, event.args.poolId),
        deploymentId: phaseOneDeploymentId!,
        positionId: event.args.positionId,
        poolId: event.args.poolId,
        ...state,
      })
      .onConflictDoUpdate(state);
  });
}

onPhaseOne("PhaseOneStatics:ManagedLiquidityChanged", async ({ event, context }) => {
  await context.db
    .update(managedGaugePosition, {
      key: managedPositionKey(event.args.positionId, event.args.poolId),
    })
    .set({ liquidity: event.args.liquidity, updatedAtBlock: event.block.number });
});

onPhaseOne("PhaseOneStatics:ManagedLiquidityRebalanced", async ({ event, context }) => {
  await context.db
    .update(managedGaugePosition, {
      key: managedPositionKey(event.args.positionId, event.args.poolId),
    })
    .set({
      posmTokenId: event.args.newPosmTokenId,
      manager: getAddress(event.args.manager),
      tickLower: event.args.tickLower,
      tickUpper: event.args.tickUpper,
      liquidity: event.args.liquidity,
      active: true,
      updatedAtBlock: event.block.number,
    });
});

onPhaseOne("PhaseOneStatics:ManagedLiquidityExited", async ({ event, context }) => {
  await context.db
    .update(managedGaugePosition, {
      key: managedPositionKey(event.args.positionId, event.args.poolId),
    })
    .set({ liquidity: 0n, active: false, updatedAtBlock: event.block.number });
});

onPhaseOne("PhaseOneStatics:PoolRewardAssetAppended", async ({ event, context }) => {
  await context.db.insert(poolRewardSlot).values({
    key: rewardSlotKey(event.args.poolId, event.args.slot),
    deploymentId: phaseOneDeploymentId!,
    poolId: event.args.poolId,
    slot: event.args.slot,
    asset: getAddress(event.args.asset),
    allocatorShareBps: 0,
    lpFunded: 0n,
    allocatorFunded: 0n,
    periodFinish: 0n,
    updatedAtBlock: event.block.number,
  });
});

onPhaseOne("PhaseOneStatics:PoolRewardAllocatorShareSet", async ({ event, context }) => {
  await context.db
    .update(poolRewardSlot, { key: rewardSlotKey(event.args.poolId, event.args.slot) })
    .set({
      allocatorShareBps: event.args.allocatorShareBps,
      updatedAtBlock: event.block.number,
    });
});

onPhaseOne("PhaseOneStatics:PoolRewardFunded", async ({ event, context }) => {
  await context.db
    .insert(poolRewardSlot)
    .values({
      key: rewardSlotKey(event.args.poolId, event.args.slot),
      deploymentId: phaseOneDeploymentId!,
      poolId: event.args.poolId,
      slot: event.args.slot,
      asset: getAddress(event.args.asset),
      allocatorShareBps: 0,
      lpFunded: event.args.lpAmount,
      allocatorFunded: 0n,
      periodFinish: BigInt(event.args.periodFinish),
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate((row) => ({
      asset: getAddress(event.args.asset),
      lpFunded: row.lpFunded + event.args.lpAmount,
      periodFinish: BigInt(event.args.periodFinish),
      updatedAtBlock: event.block.number,
    }));
});

onPhaseOne("PhaseOneStatics:PoolAllocatorRewardFunded", async ({ event, context }) => {
  await context.db
    .insert(poolRewardSlot)
    .values({
      key: rewardSlotKey(event.args.poolId, event.args.slot),
      deploymentId: phaseOneDeploymentId!,
      poolId: event.args.poolId,
      slot: event.args.slot,
      asset: getAddress(event.args.asset),
      allocatorShareBps: 0,
      lpFunded: 0n,
      allocatorFunded: event.args.allocatorAmount,
      periodFinish: BigInt(event.args.periodFinish),
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate((row) => ({
      asset: getAddress(event.args.asset),
      allocatorFunded: row.allocatorFunded + event.args.allocatorAmount,
      periodFinish: BigInt(event.args.periodFinish),
      updatedAtBlock: event.block.number,
    }));
});

for (const eventName of [
  "GaugeReserveFunded",
  "GaugeScheduleActivated",
  "GaugeReleaseBpsScheduled",
  "GaugeAllocationCooldownSet",
] as const) {
  onPhaseOne(`PhaseOneStatics:${eventName}`, async ({ event, context }) => {
    const reserve = await context.client.readContract({
      address: event.log.address,
      abi: staticsGaugeIncentivesAbi,
      functionName: "gaugeReserve",
      blockNumber: event.block.number,
    });
    await context.db
      .insert(gaugeReserveState)
      .values({
        key: phaseOneDeploymentId!,
        deploymentId: phaseOneDeploymentId!,
        activated: reserve.activated,
        releaseBps: reserve.releaseBps,
        pendingReleaseBps: reserve.pendingReleaseBps,
        pendingReleaseAt: BigInt(reserve.pendingReleaseAt),
        deferredMaturityAt: BigInt(reserve.deferredMaturityAt),
        scheduleStart: BigInt(reserve.scheduleStart),
        lastCheckpoint: BigInt(reserve.lastCheckpoint),
        periodStart: BigInt(reserve.periodStart),
        periodFinish: BigInt(reserve.periodFinish),
        currentPeriod: reserve.currentPeriod,
        allocationCooldown: BigInt(reserve.allocationCooldown),
        available: reserve.available,
        deferred: reserve.deferred,
        committed: reserve.committed,
        periodBudget: reserve.periodBudget,
        periodAccounted: reserve.periodAccounted,
        totalAllocatedWeight: reserve.totalAllocatedWeight,
        globalIndexX160: reserve.globalIndexX160,
        unsettledRoutingLiability: reserve.unsettledRoutingLiability,
        updatedAtBlock: event.block.number,
        updatedAtTimestamp: event.block.timestamp,
      })
      .onConflictDoUpdate({
        activated: reserve.activated,
        releaseBps: reserve.releaseBps,
        pendingReleaseBps: reserve.pendingReleaseBps,
        pendingReleaseAt: BigInt(reserve.pendingReleaseAt),
        deferredMaturityAt: BigInt(reserve.deferredMaturityAt),
        scheduleStart: BigInt(reserve.scheduleStart),
        lastCheckpoint: BigInt(reserve.lastCheckpoint),
        periodStart: BigInt(reserve.periodStart),
        periodFinish: BigInt(reserve.periodFinish),
        currentPeriod: reserve.currentPeriod,
        allocationCooldown: BigInt(reserve.allocationCooldown),
        available: reserve.available,
        deferred: reserve.deferred,
        committed: reserve.committed,
        periodBudget: reserve.periodBudget,
        periodAccounted: reserve.periodAccounted,
        totalAllocatedWeight: reserve.totalAllocatedWeight,
        globalIndexX160: reserve.globalIndexX160,
        unsettledRoutingLiability: reserve.unsettledRoutingLiability,
        updatedAtBlock: event.block.number,
        updatedAtTimestamp: event.block.timestamp,
      });
  });
}

onPhaseOne("PhaseOneStatics:GaugePeriodStarted", async ({ event, context }) => {
  await context.db.insert(gaugePeriod).values({
    key: phaseOneKey(event.args.period),
    deploymentId: phaseOneDeploymentId!,
    period: event.args.period,
    start: BigInt(event.args.start),
    finish: BigInt(event.args.finish),
    releaseBps: event.args.releaseBps,
    budget: event.args.budget,
    totalAllocatedWeight: event.args.totalAllocatedWeight,
    blockNumber: event.block.number,
  });

  const reserve = await context.client.readContract({
    address: event.log.address,
    abi: staticsGaugeIncentivesAbi,
    functionName: "gaugeReserve",
    blockNumber: event.block.number,
  });
  await context.db
    .insert(gaugeReserveState)
    .values({
      key: phaseOneDeploymentId!,
      deploymentId: phaseOneDeploymentId!,
      activated: reserve.activated,
      releaseBps: reserve.releaseBps,
      pendingReleaseBps: reserve.pendingReleaseBps,
      pendingReleaseAt: BigInt(reserve.pendingReleaseAt),
      deferredMaturityAt: BigInt(reserve.deferredMaturityAt),
      scheduleStart: BigInt(reserve.scheduleStart),
      lastCheckpoint: BigInt(reserve.lastCheckpoint),
      periodStart: BigInt(reserve.periodStart),
      periodFinish: BigInt(reserve.periodFinish),
      currentPeriod: reserve.currentPeriod,
      allocationCooldown: BigInt(reserve.allocationCooldown),
      available: reserve.available,
      deferred: reserve.deferred,
      committed: reserve.committed,
      periodBudget: reserve.periodBudget,
      periodAccounted: reserve.periodAccounted,
      totalAllocatedWeight: reserve.totalAllocatedWeight,
      globalIndexX160: reserve.globalIndexX160,
      unsettledRoutingLiability: reserve.unsettledRoutingLiability,
      updatedAtBlock: event.block.number,
      updatedAtTimestamp: event.block.timestamp,
    })
    .onConflictDoUpdate({
      activated: reserve.activated,
      releaseBps: reserve.releaseBps,
      pendingReleaseBps: reserve.pendingReleaseBps,
      pendingReleaseAt: BigInt(reserve.pendingReleaseAt),
      deferredMaturityAt: BigInt(reserve.deferredMaturityAt),
      scheduleStart: BigInt(reserve.scheduleStart),
      lastCheckpoint: BigInt(reserve.lastCheckpoint),
      periodStart: BigInt(reserve.periodStart),
      periodFinish: BigInt(reserve.periodFinish),
      currentPeriod: reserve.currentPeriod,
      allocationCooldown: BigInt(reserve.allocationCooldown),
      available: reserve.available,
      deferred: reserve.deferred,
      committed: reserve.committed,
      periodBudget: reserve.periodBudget,
      periodAccounted: reserve.periodAccounted,
      totalAllocatedWeight: reserve.totalAllocatedWeight,
      globalIndexX160: reserve.globalIndexX160,
      unsettledRoutingLiability: reserve.unsettledRoutingLiability,
      updatedAtBlock: event.block.number,
      updatedAtTimestamp: event.block.timestamp,
    });
});

onPhaseOne("PhaseOneStatics:PositionGaugeAllocationsSet", async ({ event, context }) => {
  const snapshot = normalizeGaugeAllocationSnapshot(
    await context.client.readContract({
      address: event.log.address,
      abi: staticsGaugeIncentivesAbi,
      functionName: "gaugePositionAllocations",
      args: [event.args.positionId],
      blockNumber: event.block.number,
    })
  );
  // eth_call at this block returns its ending state, including later transactions.
  const serialized = allocationSnapshotJson(snapshot);
  await context.db
    .insert(positionGaugeState)
    .values({
      key: phaseOneKey(event.args.positionId),
      deploymentId: phaseOneDeploymentId!,
      positionId: event.args.positionId,
      nextAllocationAt: BigInt(snapshot.nextAllocationAt),
      totalAllocated: snapshot.totalAllocated,
      lockedStake: snapshot.lockedStake,
      ...serialized,
      transactionHash: event.transaction.hash,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({
      nextAllocationAt: BigInt(snapshot.nextAllocationAt),
      totalAllocated: snapshot.totalAllocated,
      lockedStake: snapshot.lockedStake,
      ...serialized,
      transactionHash: event.transaction.hash,
      updatedAtBlock: event.block.number,
    });
});

for (const eventName of [
  "PositionGaugeAllocationCooldownExtended",
  "PositionGaugeAllocationsClearedByStakeLoss",
] as const) {
  onPhaseOne(`PhaseOneStatics:${eventName}`, async ({ event, context }) => {
    const snapshot = normalizeGaugeAllocationSnapshot(
      await context.client.readContract({
        address: event.log.address,
        abi: staticsGaugeIncentivesAbi,
        functionName: "gaugePositionAllocations",
        args: [event.args.positionId],
        blockNumber: event.block.number,
      })
    );
    const serialized = allocationSnapshotJson(snapshot);
    await context.db
      .insert(positionGaugeState)
      .values({
        key: phaseOneKey(event.args.positionId),
        deploymentId: phaseOneDeploymentId!,
        positionId: event.args.positionId,
        nextAllocationAt: BigInt(snapshot.nextAllocationAt),
        totalAllocated: snapshot.totalAllocated,
        lockedStake: snapshot.lockedStake,
        ...serialized,
        transactionHash: event.transaction.hash,
        updatedAtBlock: event.block.number,
      })
      .onConflictDoUpdate({
        nextAllocationAt: BigInt(snapshot.nextAllocationAt),
        totalAllocated: snapshot.totalAllocated,
        lockedStake: snapshot.lockedStake,
        ...serialized,
        transactionHash: event.transaction.hash,
        updatedAtBlock: event.block.number,
      });
  });
}

onPhaseOne("PhaseOneStatics:ProtocolGaugeRewardCredited", async ({ event, context }) => {
  const state = await context.client.readContract({
    address: event.log.address,
    abi: staticsGaugeIncentivesAbi,
    functionName: "gaugePoolWeight",
    args: [event.args.poolId],
    blockNumber: event.block.number,
  });
  await context.db
    .insert(gaugePoolState)
    .values({
      key: phaseOneKey(event.args.poolId),
      deploymentId: phaseOneDeploymentId!,
      poolId: event.args.poolId,
      weight: state.weight,
      storedVersion: state.storedVersion,
      currentVersion: state.currentVersion,
      restrictionSequence: state.restrictionSequence,
      indexCursorX160: state.indexCursorX160,
      pendingReward: state.pendingReward,
      stale: state.stale,
      lastCredited: event.args.amount,
      lastRecycled: 0n,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({
      weight: state.weight,
      storedVersion: state.storedVersion,
      currentVersion: state.currentVersion,
      restrictionSequence: state.restrictionSequence,
      indexCursorX160: state.indexCursorX160,
      pendingReward: state.pendingReward,
      stale: state.stale,
      lastCredited: event.args.amount,
      updatedAtBlock: event.block.number,
    });
  await context.db.insert(phaseOneActivity).values({
    key: phaseOneEventKey(event.transaction.hash, event.log.logIndex),
    deploymentId: phaseOneDeploymentId!,
    kind: "protocol-gauge-reward-credited",
    positionId: null,
    poolId: event.args.poolId,
    asset: null,
    amount: event.args.amount,
    slot: 0,
    actor: null,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    logIndex: event.log.logIndex,
  });
});

onPhaseOne("PhaseOneStatics:ProtocolGaugeRewardRecycled", async ({ event, context }) => {
  const state = await context.client.readContract({
    address: event.log.address,
    abi: staticsGaugeIncentivesAbi,
    functionName: "gaugePoolWeight",
    args: [event.args.poolId],
    blockNumber: event.block.number,
  });
  await context.db
    .insert(gaugePoolState)
    .values({
      key: phaseOneKey(event.args.poolId),
      deploymentId: phaseOneDeploymentId!,
      poolId: event.args.poolId,
      weight: state.weight,
      storedVersion: state.storedVersion,
      currentVersion: state.currentVersion,
      restrictionSequence: state.restrictionSequence,
      indexCursorX160: state.indexCursorX160,
      pendingReward: state.pendingReward,
      stale: state.stale,
      lastCredited: 0n,
      lastRecycled: event.args.amount,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({
      weight: state.weight,
      storedVersion: state.storedVersion,
      currentVersion: state.currentVersion,
      restrictionSequence: state.restrictionSequence,
      indexCursorX160: state.indexCursorX160,
      pendingReward: state.pendingReward,
      stale: state.stale,
      lastRecycled: event.args.amount,
      updatedAtBlock: event.block.number,
    });
  await context.db.insert(phaseOneActivity).values({
    key: phaseOneEventKey(event.transaction.hash, event.log.logIndex),
    deploymentId: phaseOneDeploymentId!,
    kind: "protocol-gauge-reward-recycled",
    positionId: null,
    poolId: event.args.poolId,
    asset: null,
    amount: event.args.amount,
    slot: 0,
    actor: null,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    logIndex: event.log.logIndex,
  });
});

onPhaseOne("PhaseOneStatics:GaugeAllocatorRewardClaimed", async ({ event, context }) => {
  await context.db.insert(phaseOneActivity).values({
    key: phaseOneEventKey(event.transaction.hash, event.log.logIndex),
    deploymentId: phaseOneDeploymentId!,
    kind: "allocator-reward-claimed",
    positionId: event.args.positionId,
    poolId: event.args.poolId,
    asset: getAddress(event.args.asset),
    amount: event.args.received,
    slot: event.args.slot,
    actor: getAddress(event.args.receiver),
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    logIndex: event.log.logIndex,
  });
});

onPhaseOne("PhaseOneStatics:GaugeAllocatorRewardForfeited", async ({ event, context }) => {
  await context.db.insert(phaseOneActivity).values({
    key: phaseOneEventKey(event.transaction.hash, event.log.logIndex),
    deploymentId: phaseOneDeploymentId!,
    kind: "allocator-reward-forfeited",
    positionId: event.args.positionId,
    poolId: event.args.poolId,
    asset: getAddress(event.args.asset),
    amount: event.args.amount,
    slot: event.args.slot,
    actor: null,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    logIndex: event.log.logIndex,
  });
});

onPhaseOne("PhaseOneStatics:LpRewardsClaimed", async ({ event, context }) => {
  await context.db.insert(phaseOneActivity).values({
    key: phaseOneEventKey(event.transaction.hash, event.log.logIndex),
    deploymentId: phaseOneDeploymentId!,
    kind: "lp-reward-claimed",
    positionId: event.args.positionId,
    poolId: event.args.poolId,
    asset: getAddress(event.args.asset),
    amount: event.args.received,
    slot: event.args.slot,
    actor: getAddress(event.args.receiver),
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    logIndex: event.log.logIndex,
  });
});

onPhaseOne("PhaseOneStatics:LpRewardForfeited", async ({ event, context }) => {
  await context.db.insert(phaseOneActivity).values({
    key: phaseOneEventKey(event.transaction.hash, event.log.logIndex),
    deploymentId: phaseOneDeploymentId!,
    kind: "lp-reward-forfeited",
    positionId: event.args.positionId,
    poolId: event.args.poolId,
    asset: getAddress(event.args.asset),
    amount: event.args.amount,
    slot: event.args.slot,
    actor: null,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    logIndex: event.log.logIndex,
  });
});

onPhaseOne("PhaseOneStatics:RewardClaimed", async ({ event, context }) => {
  await context.db.insert(phaseOneActivity).values({
    key: phaseOneEventKey(event.transaction.hash, event.log.logIndex),
    deploymentId: phaseOneDeploymentId!,
    kind: "global-reward-claimed",
    positionId: event.args.positionId,
    poolId: null,
    asset: getAddress(event.args.asset),
    amount: event.args.amount,
    slot: null,
    actor: getAddress(event.args.receiver),
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    logIndex: event.log.logIndex,
  });
});

onPhaseOne("PhaseOneStatics:ProtocolPoolRevenueSettled", async ({ event, context }) => {
  await context.db.insert(phaseOneActivity).values({
    key: phaseOneEventKey(event.transaction.hash, event.log.logIndex),
    deploymentId: phaseOneDeploymentId!,
    kind: "protocol-revenue-settled",
    positionId: null,
    poolId: event.args.poolId,
    asset: getAddress(event.args.asset),
    amount: event.args.grossAmount,
    slot: null,
    actor: getAddress(event.args.caller),
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    logIndex: event.log.logIndex,
  });
});

onPhaseOne("PhaseOneStatics:CreatorRevenueClaimed", async ({ event, context }) => {
  await context.db.insert(phaseOneActivity).values({
    key: phaseOneEventKey(event.transaction.hash, event.log.logIndex),
    deploymentId: phaseOneDeploymentId!,
    kind: "creator-revenue-claimed",
    positionId: null,
    poolId: event.args.poolId,
    asset: getAddress(event.args.asset),
    amount: event.args.received,
    slot: null,
    actor: getAddress(event.args.receiver),
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    logIndex: event.log.logIndex,
  });
});
