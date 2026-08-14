import { index, onchainTable } from "ponder";

export const activeLoan = onchainTable(
  "active_loan",
  (table) => ({
    id: table.bigint().primaryKey(),
    positionId: table.bigint().notNull(),
    basketId: table.bigint().notNull(),
    maturity: table.bigint().notNull(),
    recoverableAt: table.bigint().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({ recoverable: index().on(table.recoverableAt, table.id) })
);

export const v4Position = onchainTable(
  "v4_position",
  (table) => ({
    id: table.bigint().primaryKey(),
    owner: table.hex().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({ owner: index().on(table.owner, table.id) })
);

export const genesisNft = onchainTable(
  "genesis_nft",
  (table) => ({
    id: table.bigint().primaryKey(),
    owner: table.hex().notNull(),
    tier: table.integer().notNull(),
    multiplierBps: table.integer().notNull(),
    linkedPositionId: table.bigint().notNull(),
    updatedAtBlock: table.bigint().notNull(),
  }),
  (table) => ({ owner: index().on(table.owner, table.id) })
);
