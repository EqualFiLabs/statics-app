import { getAddress, zeroAddress, type Address } from "viem";

export type StatementMovement = {
  asset: Address;
  space: "wallet" | "internal" | "entitlement";
  direction: "debit" | "credit";
  purpose: string;
  actor: Address | null;
  amount: bigint;
};

/** Derive only flows explicitly established by the event, in canonical child order. */
export function statementMovements(
  name: string,
  args: Record<string, unknown>,
  identities: { stakingAsset: Address | null; poolCurrencies: readonly Address[] | null }
): StatementMovement[] {
  const movements: StatementMovement[] = [];
  function move(
    asset: Address,
    space: StatementMovement["space"],
    direction: StatementMovement["direction"],
    purpose: string,
    amount: unknown,
    actor: Address | null = null
  ) {
    const quantity = BigInt(amount as bigint | string);
    if (quantity > 0n)
      movements.push({
        asset: getAddress(asset),
        space,
        direction,
        purpose,
        amount: quantity,
        actor: actor === null ? null : getAddress(actor),
      });
  }
  if (name === "Staked" || name === "Unstaked") {
    if (!identities.stakingAsset) throw new Error("Missing staking currency identity.");
    move(
      identities.stakingAsset,
      "wallet",
      name === "Staked" ? "debit" : "credit",
      name === "Staked" ? "stake" : "unstake",
      args.amount,
      (args.payer ?? args.receiver) as Address
    );
  }
  if (name === "PositionCreationFeePaid")
    move(zeroAddress, "wallet", "credit", "creation-fee", args.amount, args.treasury as Address);
  if (name.startsWith("ManagedLiquidity")) {
    const currencies = identities.poolCurrencies;
    if (!currencies || currencies.length !== 2) throw new Error("Missing indexed pool currencies.");
    if (name === "ManagedLiquidityFeesCollected")
      currencies.forEach((asset, i) =>
        move(
          asset,
          "wallet",
          "credit",
          "trading-fees",
          args[`amount${i}`],
          args.receiver as Address
        )
      );
    else if (name !== "ManagedLiquidityAttached") {
      const m = args.movement as Record<string, unknown>;
      currencies.forEach((asset, i) => {
        move(asset, "wallet", "debit", "liquidity-funding", m[`paid${i}`], m.payer as Address);
        move(
          asset,
          "wallet",
          "credit",
          name === "ManagedLiquidityProvided" ||
            name === "ManagedLiquidityRebalanced" ||
            m.payer !== zeroAddress
            ? "liquidity-refund"
            : "liquidity-output",
          m[`received${i}`],
          m.receiver as Address
        );
      });
      if (name === "ManagedLiquidityRebalanced") {
        const settlement = args.settlement as Record<string, unknown>;
        currencies.forEach((asset, i) => {
          move(asset, "internal", "credit", "rebalance-withdrawal", settlement[`withdrawn${i}`]);
          move(asset, "internal", "debit", "rebalance-mint-spend", settlement[`mintSpent${i}`]);
          move(
            asset,
            "internal",
            "credit",
            "rebalance-mint-return",
            settlement[`mintReceived${i}`]
          );
        });
      }
    }
  }
  if (["RewardClaimed", "LpRewardsClaimed", "GaugeAllocatorRewardClaimed"].includes(name)) {
    move(args.asset as Address, "internal", "debit", "reward-payout-debit", args.debited);
    move(
      args.asset as Address,
      "wallet",
      "credit",
      "reward-payout",
      args.received,
      args.receiver as Address
    );
  }
  if (name === "PositionRewardSettled")
    move(args.asset as Address, "entitlement", "credit", "reward-settlement", args.amount);
  if (name === "LpRewardForfeited" || name === "GaugeAllocatorRewardForfeited")
    move(args.asset as Address, "entitlement", "debit", "reward-forfeiture", args.amount);
  return movements;
}
