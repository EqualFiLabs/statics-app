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
    sqrtPriceX96: table.bigint().notNull(),
    liquidity: table.bigint().notNull(),
    tick: table.integer().notNull(),
    fee: table.integer().notNull(),
    transactionHash: table.hex().notNull(),
    blockNumber: table.bigint().notNull(),
    blockTimestamp: table.bigint().notNull(),
  }),
  (table) => ({ market: index().on(table.deploymentId, table.poolId, table.blockNumber) })
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
