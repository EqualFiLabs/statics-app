import { render, screen } from "@/test/render";
import { describe, expect, it } from "vitest";

import { PositionCollateralSummary } from "@/components/positions/PositionCollateralSummary";
import type { PositionCollateral } from "@/lib/positions/positions";

const collateral = [
  {
    basket: {
      basketId: 0n,
      symbol: "TPA1",
      token: { decimals: 18 },
    },
    depositedShares: 200n * 10n ** 18n,
    lockedShares: 25n * 10n ** 18n,
    withdrawableAfterBlock: 100n,
  },
] as unknown as readonly PositionCollateral[];

describe("position collateral summary", () => {
  it("shows deposited, available, and loan-locked BasketTokens", () => {
    render(<PositionCollateralSummary collateral={collateral} currentBlock={101n} />);

    expect(screen.getByText("200 TPA1")).toBeInTheDocument();
    expect(screen.getByText("175 TPA1")).toBeInTheDocument();
    expect(screen.getByText("25 TPA1")).toBeInTheDocument();
    expect(screen.getByText(/belong to this PositionNFT/i)).toBeInTheDocument();
  });

  it("shows the next-block withdrawal gate without hiding ownership", () => {
    render(<PositionCollateralSummary collateral={collateral} currentBlock={99n} compact />);

    expect(screen.getByText("200 TPA1")).toBeInTheDocument();
    expect(screen.getByText("Next block")).toBeInTheDocument();
  });
});
