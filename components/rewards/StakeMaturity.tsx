import { formatUnits } from "viem";

import type { TokenMetadata } from "@/lib/baskets/baskets";
import { formatMaturity, groupByMaturity, type StakingSnapshot } from "@/lib/positions/staking";

function displayAmount(value: bigint, decimals: number, precision = 6): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, precision).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

/**
 * Says which part of a stake is earning and when the rest starts.
 *
 * Deliberately never phrased as a proportion of the total. "60 of 100
 * eligible" reads as though 40 went missing; the stake is warming up, not
 * short. The total is stated by the caller, and this only ever adds the
 * timing.
 */
export function StakeMaturity({
  snapshot,
  stakingToken,
  now,
}: Readonly<{
  snapshot: StakingSnapshot | undefined;
  stakingToken: TokenMetadata;
  now: bigint;
}>) {
  if (!snapshot) return null;

  const maturing = groupByMaturity(snapshot.maturing);

  if (maturing.length === 0) {
    // Only worth saying when there is something earning to say it about.
    return snapshot.earning.length > 0 ? (
      <p className="stake-maturity is-earning">All of your stake is earning.</p>
    ) : null;
  }

  return (
    <div className="stake-maturity">
      {maturing.map((group) => (
        <p key={group.eligibleAt.toString()}>
          <strong>
            {displayAmount(group.pendingStake, stakingToken.decimals)} {stakingToken.symbol}
          </strong>{" "}
          starts earning {group.tokens.map((token) => token.symbol).join(", ")} at{" "}
          {formatMaturity(group.eligibleAt, now)}.
        </p>
      ))}
    </div>
  );
}
