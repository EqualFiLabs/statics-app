import { index, onchainTable } from "ponder";

export const activeLoan = onchainTable(
  "active_loan",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    id: table.bigint().notNull(),
    positionId: table.bigint().notNull(),
    basketId: table.bigint().notNull(),
    maturity: table.bigint().notNull(),
    recoverableAt: table.bigint().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({ recoverable: index().on(table.deploymentId, table.recoverableAt, table.id) })
);

export const activeGenesisCredit = onchainTable(
  "active_genesis_credit",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    genesisId: table.bigint().notNull(),
    owner: table.hex().notNull(),
    principal: table.bigint().notNull(),
    maturity: table.bigint().notNull(),
    recoverableAt: table.bigint().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({
    recoverable: index().on(table.deploymentId, table.recoverableAt, table.genesisId),
  })
);

export const v4Position = onchainTable(
  "v4_position",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    id: table.bigint().notNull(),
    owner: table.hex().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({ owner: index().on(table.deploymentId, table.owner, table.id) })
);

export const genesisNft = onchainTable(
  "genesis_nft",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    id: table.bigint().notNull(),
    owner: table.hex().notNull(),
    tier: table.integer().notNull(),
    multiplierBps: table.integer().notNull(),
    linkedPositionId: table.bigint().notNull(),
    registered: table.boolean().notNull(),
    effectiveWeight: table.bigint().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({
    owner: index().on(table.deploymentId, table.owner, table.id),
    inventory: index().on(table.deploymentId, table.id),
  })
);

export const genesisRewardClaim = onchainTable(
  "genesis_reward_claim",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    genesisId: table.bigint(),
    owner: table.hex().notNull(),
    asset: table.hex().notNull(),
    amount: table.bigint().notNull(),
    previousOwnerClaim: table.boolean().notNull(),
    blockNumber: table.bigint().notNull(),
  }),
  (table) => ({ owner: index().on(table.deploymentId, table.owner, table.blockNumber) })
);

export const harvestedFee = onchainTable(
  "harvested_fee",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    distributor: table.hex().notNull(),
    asset: table.hex().notNull(),
    amount: table.bigint().notNull(),
    cumulativeAmount: table.bigint().notNull(),
    blockNumber: table.bigint().notNull(),
  }),
  (table) => ({ asset: index().on(table.deploymentId, table.asset, table.blockNumber) })
);

export const marketSwap = onchainTable(
  "market_swap",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    poolId: table.hex().notNull(),
    sender: table.hex().notNull(),
    amount0: table.bigint().notNull(),
    amount1: table.bigint().notNull(),
    volume0: table.bigint().notNull(),
    volume1: table.bigint().notNull(),
    price1Per0Wad: table.bigint().notNull(),
    sqrtPriceX96: table.bigint().notNull(),
    liquidity: table.bigint().notNull(),
    tick: table.integer().notNull(),
    fee: table.integer().notNull(),
    transactionHash: table.hex().notNull(),
    blockNumber: table.bigint().notNull(),
    blockTimestamp: table.bigint().notNull(),
    logIndex: table.integer().notNull(),
  }),
  (table) => ({
    market: index().on(
      table.deploymentId,
      table.poolId,
      table.blockTimestamp,
      table.blockNumber,
      table.logIndex
    ),
  })
);

export const marketCandle = onchainTable(
  "market_candle",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    poolId: table.hex().notNull(),
    bucketTimestamp: table.bigint().notNull(),
    openSqrtPriceX96: table.bigint().notNull(),
    highSqrtPriceX96: table.bigint().notNull(),
    lowSqrtPriceX96: table.bigint().notNull(),
    closeSqrtPriceX96: table.bigint().notNull(),
    volume0: table.bigint().notNull(),
    volume1: table.bigint().notNull(),
    zeroForOneCount: table.integer().notNull(),
    oneForZeroCount: table.integer().notNull(),
    swapCount: table.integer().notNull(),
    firstBlock: table.bigint().notNull(),
    lastBlock: table.bigint().notNull(),
  }),
  (table) => ({ market: index().on(table.deploymentId, table.poolId, table.bucketTimestamp) })
);

export const publicPool = onchainTable(
  "public_pool",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    poolId: table.hex().notNull(),
    creator: table.hex().notNull(),
    currency0: table.hex().notNull(),
    currency1: table.hex().notNull(),
    hook: table.hex().notNull(),
    lpFee: table.integer().notNull(),
    tickSpacing: table.integer().notNull(),
    initialSqrtPriceX96: table.bigint().notNull(),
    initialTick: table.integer().notNull(),
    inputFeeBps: table.integer().notNull(),
    outputFeeBps: table.integer().notNull(),
    feeRateOverridden: table.boolean().notNull(),
    quarantined: table.boolean().notNull(),
    decommissioned: table.boolean().notNull(),
    polActivated: table.boolean().notNull(),
    gaugeInitialized: table.boolean().notNull(),
    gaugeStopped: table.boolean().notNull(),
    decommissionStarted: table.boolean().notNull(),
    decommissionFinalized: table.boolean().notNull(),
    createdAtBlock: table.bigint().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({
    inventory: index().on(table.deploymentId, table.decommissioned, table.poolId),
    creator: index().on(table.deploymentId, table.creator, table.poolId),
  })
);

export const rewardRestriction = onchainTable(
  "reward_restriction",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    asset: table.hex().notNull(),
    restricted: table.boolean().notNull(),
    nonce: table.bigint().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({ asset: index().on(table.deploymentId, table.asset) })
);

export const phaseOneMarketSwap = onchainTable(
  "phase_one_market_swap",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    poolId: table.hex().notNull(),
    sequence: table.bigint().notNull(),
    amount0: table.bigint().notNull(),
    amount1: table.bigint().notNull(),
    staticsFee0: table.bigint().notNull(),
    staticsFee1: table.bigint().notNull(),
    finalTick: table.integer().notNull(),
    nativeLpFee: table.integer().notNull(),
    flags: table.integer().notNull(),
    internal: table.boolean().notNull(),
    transactionHash: table.hex().notNull(),
    blockNumber: table.bigint().notNull(),
    blockTimestamp: table.bigint().notNull(),
    logIndex: table.integer().notNull(),
  }),
  (table) => ({
    market: index().on(
      table.deploymentId,
      table.poolId,
      table.sequence,
      table.blockNumber,
      table.logIndex
    ),
  })
);

export const phaseOneMarketObservation = onchainTable(
  "phase_one_market_observation",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    poolId: table.hex().notNull(),
    observationId: table.bigint().notNull(),
    sequence: table.bigint().notNull(),
    timestamp: table.bigint().notNull(),
    tick: table.integer().notNull(),
    nativeLpFee: table.integer().notNull(),
    flags: table.integer().notNull(),
    tickCumulative: table.bigint().notNull(),
    externalVolume0: table.bigint().notNull(),
    externalVolume1: table.bigint().notNull(),
    internalVolume0: table.bigint().notNull(),
    internalVolume1: table.bigint().notNull(),
    staticsFees0: table.bigint().notNull(),
    staticsFees1: table.bigint().notNull(),
    externalSwapCount: table.bigint().notNull(),
    internalSwapCount: table.bigint().notNull(),
    blockNumber: table.bigint().notNull(),
  }),
  (table) => ({
    market: index().on(table.deploymentId, table.poolId, table.timestamp, table.observationId),
  })
);

export const positionNft = onchainTable(
  "position_nft",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    positionId: table.bigint().notNull(),
    owner: table.hex().notNull(),
    stakedBalance: table.bigint().notNull(),
    activeLegCount: table.bigint().notNull(),
    unresolvedObligationCount: table.bigint().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({ owner: index().on(table.deploymentId, table.owner, table.positionId) })
);

export const managedGaugePosition = onchainTable(
  "managed_gauge_position",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    positionId: table.bigint().notNull(),
    poolId: table.hex().notNull(),
    posmTokenId: table.bigint().notNull(),
    manager: table.hex().notNull(),
    tickLower: table.integer().notNull(),
    tickUpper: table.integer().notNull(),
    liquidity: table.bigint().notNull(),
    active: table.boolean().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({
    position: index().on(table.deploymentId, table.positionId, table.poolId),
    pool: index().on(table.deploymentId, table.poolId, table.active),
  })
);

export const poolRewardSlot = onchainTable(
  "pool_reward_slot",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    poolId: table.hex().notNull(),
    slot: table.integer().notNull(),
    asset: table.hex().notNull(),
    allocatorShareBps: table.integer().notNull(),
    lpFunded: table.bigint().notNull(),
    allocatorFunded: table.bigint().notNull(),
    periodFinish: table.bigint().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({ pool: index().on(table.deploymentId, table.poolId, table.slot) })
);

export const gaugeReserveState = onchainTable("gauge_reserve_state", (table) => ({
  key: table.text().primaryKey(),
  deploymentId: table.text().notNull(),
  activated: table.boolean().notNull(),
  releaseBps: table.integer().notNull(),
  pendingReleaseBps: table.integer().notNull(),
  pendingReleaseAt: table.bigint().notNull(),
  deferredMaturityAt: table.bigint().notNull(),
  scheduleStart: table.bigint().notNull(),
  lastCheckpoint: table.bigint().notNull(),
  periodStart: table.bigint().notNull(),
  periodFinish: table.bigint().notNull(),
  currentPeriod: table.bigint().notNull(),
  allocationCooldown: table.bigint().notNull(),
  available: table.bigint().notNull(),
  deferred: table.bigint().notNull(),
  committed: table.bigint().notNull(),
  periodBudget: table.bigint().notNull(),
  periodAccounted: table.bigint().notNull(),
  totalAllocatedWeight: table.bigint().notNull(),
  globalIndexX160: table.bigint().notNull(),
  unsettledRoutingLiability: table.bigint().notNull(),
  updatedAtBlock: table.bigint().notNull(),
  updatedAtTimestamp: table.bigint().notNull(),
}));

export const gaugePoolState = onchainTable(
  "gauge_pool_state",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    poolId: table.hex().notNull(),
    weight: table.bigint().notNull(),
    storedVersion: table.hex().notNull(),
    currentVersion: table.hex().notNull(),
    restrictionSequence: table.bigint().notNull(),
    indexCursorX160: table.bigint().notNull(),
    pendingReward: table.bigint().notNull(),
    stale: table.boolean().notNull(),
    lastCredited: table.bigint().notNull(),
    lastRecycled: table.bigint().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({ pool: index().on(table.deploymentId, table.poolId) })
);

export const gaugePeriod = onchainTable(
  "gauge_period",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    period: table.bigint().notNull(),
    start: table.bigint().notNull(),
    finish: table.bigint().notNull(),
    releaseBps: table.integer().notNull(),
    budget: table.bigint().notNull(),
    totalAllocatedWeight: table.bigint().notNull(),
    blockNumber: table.bigint().notNull(),
  }),
  (table) => ({ periods: index().on(table.deploymentId, table.period) })
);

export const positionGaugeState = onchainTable(
  "position_gauge_state",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    positionId: table.bigint().notNull(),
    nextAllocationAt: table.bigint().notNull(),
    totalAllocated: table.bigint().notNull(),
    lockedStake: table.bigint().notNull(),
    poolIdsJson: table.text().notNull(),
    amountsJson: table.text().notNull(),
    eligibilityVersionsJson: table.text().notNull(),
    transactionHash: table.hex().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({ position: index().on(table.deploymentId, table.positionId) })
);

export const phaseOneActivity = onchainTable(
  "phase_one_activity",
  (table) => ({
    key: table.text().primaryKey(),
    deploymentId: table.text().notNull(),
    kind: table.text().notNull(),
    positionId: table.bigint(),
    poolId: table.hex(),
    asset: table.hex(),
    amount: table.bigint(),
    slot: table.integer(),
    actor: table.hex(),
    transactionHash: table.hex().notNull(),
    blockNumber: table.bigint().notNull(),
    blockTimestamp: table.bigint().notNull(),
    logIndex: table.integer().notNull(),
  }),
  (table) => ({
    history: index().on(table.deploymentId, table.blockNumber, table.logIndex),
    position: index().on(table.deploymentId, table.positionId, table.blockNumber),
    pool: index().on(table.deploymentId, table.poolId, table.blockNumber),
  })
);

export const allocationToken = onchainTable("allocation_token", (t) => ({
  key: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  address: t.hex().notNull(),
  symbol: t.text(),
  name: t.text(),
  decimals: t.integer(),
  observedAtBlock: t.bigint().notNull(),
}));

export const allocatorStream = onchainTable(
  "allocator_stream",
  (t) => ({
    key: t.text().primaryKey(),
    deploymentId: t.text().notNull(),
    poolId: t.hex().notNull(),
    slot: t.integer().notNull(),
    asset: t.hex().notNull(),
    allocatorShareBps: t.integer().notNull(),
    eligibilityVersion: t.hex().notNull(),
    fundingRestrictionSequence: t.bigint().notNull(),
    periodStart: t.bigint().notNull(),
    periodFinish: t.bigint().notNull(),
    lastUpdate: t.bigint().notNull(),
    periodBudget: t.bigint().notNull(),
    periodEmitted: t.bigint().notNull(),
    terminated: t.boolean().notNull(),
    observedAtBlock: t.bigint().notNull(),
    observedAtTimestamp: t.bigint().notNull(),
  }),
  (t) => ({ pool: index().on(t.deploymentId, t.poolId, t.slot) })
);

// Materialized browsing data: all filtering, numeric sorting and paging happen in SQL.
export const allocationDirectoryPool = onchainTable(
  "allocation_directory_pool",
  (t) => ({
    key: t.text().primaryKey(),
    deploymentId: t.text().notNull(),
    poolId: t.hex().notNull(),
    eligible: t.boolean().notNull(),
    weight: t.bigint().notNull(),
    incentiveStreamCount: t.integer().notNull(),
    createdAtBlock: t.bigint().notNull(),
    searchText: t.text().notNull(),
    detailsJson: t.text().notNull(),
  }),
  (t) => ({
    weight: index().on(t.deploymentId, t.weight, t.poolId),
    incentives: index().on(t.deploymentId, t.incentiveStreamCount, t.poolId),
    created: index().on(t.deploymentId, t.createdAtBlock, t.poolId),
  })
);

export const allocationDirectoryState = onchainTable("allocation_directory_state", (t) => ({
  key: t.text().primaryKey(),
  deploymentId: t.text().notNull(),
  revision: t.bigint().notNull(),
  indexedAtBlock: t.bigint().notNull(),
  indexedAtTimestamp: t.bigint().notNull(),
}));
