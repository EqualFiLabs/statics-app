"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("positions");
  return (
    <section
      className={`position-collateral-summary${compact ? " is-compact" : ""}`}
      aria-label={t("collateralLabel")}
    >
      <div>
        <p className="dapp-section-label">{t("collateralLabel")}</p>
        {!compact && <p>{t("collateralDescription")}</p>}
      </div>
      {collateral.length === 0 ? (
        <p className="position-collateral-empty">{t("noCollateral")}</p>
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
                    <dt>{t("deposited")}</dt>
                    <dd>{displayAmount(holding.depositedShares, decimals)}</dd>
                  </div>
                  <div>
                    <dt>{t("available")}</dt>
                    <dd>
                      {coolingDown
                        ? t("nextBlock")
                        : `${displayAmount(available, decimals)} ${holding.basket.symbol}`}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("securingLoans")}</dt>
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
