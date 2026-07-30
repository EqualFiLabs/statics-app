"use client";

import Link from "next/link";
import { formatUnits } from "viem";

import type { PositionCollateral } from "@/lib/positions/positions";

function displayAmount(value: bigint, decimals: number): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, 4).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

export function PositionCollateralSummary({
  collateral,
  currentBlock,
  compact = false,
}: {
  collateral: readonly PositionCollateral[];
  currentBlock: bigint;
  compact?: boolean;
}) {
  return (
    <section
      className={`position-collateral-summary${compact ? " is-compact" : ""}`}
      aria-label="BasketTokens held by this position"
    >
      <div>
        <p className="dapp-section-label">BasketTokens held by this position</p>
        {!compact && (
          <p>
            These BasketTokens belong to this PositionNFT. The Diamond holds them in custody while
            they earn basket fees and support loans.
          </p>
        )}
      </div>
      {collateral.length === 0 ? (
        <p className="position-collateral-empty">No BasketTokens are deposited.</p>
      ) : (
        <ul>
          {collateral.map((holding) => {
            const decimals = holding.basket.token.decimals;
            const available = holding.depositedShares - holding.lockedShares;
            const coolingDown = currentBlock < holding.withdrawableAfterBlock;
            return (
              <li key={holding.basket.basketId.toString()}>
                <div>
                  <Link href={`/app/baskets/${holding.basket.basketId.toString()}`}>
                    {holding.basket.symbol}
                  </Link>
                  <strong>
                    {displayAmount(holding.depositedShares, decimals)} {holding.basket.symbol}
                  </strong>
                </div>
                <dl>
                  <div>
                    <dt>Deposited</dt>
                    <dd>{displayAmount(holding.depositedShares, decimals)}</dd>
                  </div>
                  <div>
                    <dt>Available to withdraw</dt>
                    <dd>
                      {coolingDown
                        ? "Next block"
                        : `${displayAmount(available, decimals)} ${holding.basket.symbol}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Securing loans</dt>
                    <dd>
                      {displayAmount(holding.lockedShares, decimals)} {holding.basket.symbol}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
