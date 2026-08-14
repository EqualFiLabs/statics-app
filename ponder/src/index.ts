import { ponder } from "ponder:registry";
import { staticsAbi } from "@statics-protocol/sdk";
import { getAddress } from "viem";

import { activeLoan, genesisNft, v4Position } from "ponder:schema";

ponder.on("Statics:LoanOriginated", async ({ event, context }) => {
  const maturity = BigInt(event.args.maturity);
  const recoveryGracePeriod = await context.client.readContract({
    address: event.log.address,
    abi: staticsAbi,
    functionName: "recoveryGracePeriod",
    blockNumber: event.block.number,
  });
  await context.db.insert(activeLoan).values({
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
  await context.db.update(activeLoan, { id: event.args.loanId }).set({
    maturity,
    recoverableAt: maturity + recoveryGracePeriod,
    updatedAtBlock: event.block.number,
  });
});

ponder.on("Statics:LoanRepaid", async ({ event, context }) => {
  await context.db.delete(activeLoan, { id: event.args.loanId });
});

ponder.on("Statics:LoanRecovered", async ({ event, context }) => {
  await context.db.delete(activeLoan, { id: event.args.loanId });
});

ponder.on("PositionManager:Transfer", async ({ event, context }) => {
  if (event.args.to === "0x0000000000000000000000000000000000000000") {
    await context.db.delete(v4Position, { id: event.args.tokenId });
    return;
  }
  await context.db
    .insert(v4Position)
    .values({
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
  for (let id = event.args.fromTokenId; id <= event.args.toTokenId; id += 1n) {
    await context.db.insert(genesisNft).values({
      id,
      owner: getAddress(event.args.toAddress),
      tier: 0,
      multiplierBps: 10_000,
      linkedPositionId: 0n,
      updatedAtBlock: event.block.number,
    });
  }
});

ponder.on("StaticsGenesis:Transfer", async ({ event, context }) => {
  if (event.args.to === "0x0000000000000000000000000000000000000000") {
    await context.db.delete(genesisNft, { id: event.args.tokenId });
    return;
  }
  await context.db
    .insert(genesisNft)
    .values({
      id: event.args.tokenId,
      owner: getAddress(event.args.to),
      tier: 0,
      multiplierBps: 10_000,
      linkedPositionId: 0n,
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
  await context.db.update(genesisNft, { id: event.args.genesisId }).set({
    tier: Number(event.args.newTier),
    multiplierBps: Number(event.args.multiplierBps),
    updatedAtBlock: event.block.number,
  });
});

ponder.on("Statics:GenesisLinked", async ({ event, context }) => {
  await context.db.update(genesisNft, { id: event.args.genesisId }).set({
    linkedPositionId: event.args.positionId,
    updatedAtBlock: event.block.number,
  });
});

ponder.on("Statics:GenesisUnlinked", async ({ event, context }) => {
  await context.db.update(genesisNft, { id: event.args.genesisId }).set({
    linkedPositionId: 0n,
    updatedAtBlock: event.block.number,
  });
});

ponder.on("Statics:GenesisActivationReset", async ({ event, context }) => {
  await context.db.update(genesisNft, { id: event.args.genesisId }).set({
    tier: 0,
    multiplierBps: 10_000,
    linkedPositionId: 0n,
    updatedAtBlock: event.block.number,
  });
});
