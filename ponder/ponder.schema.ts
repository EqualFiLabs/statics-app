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
  (table) => ({ owner: index().on(table.deploymentId, table.owner, table.id) })
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
