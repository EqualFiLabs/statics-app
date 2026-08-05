import { ponder } from "ponder:registry";
import { staticsAbi } from "@statics-protocol/sdk";
import { getAddress } from "viem";

import { activeLoan, v4Position } from "ponder:schema";

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
