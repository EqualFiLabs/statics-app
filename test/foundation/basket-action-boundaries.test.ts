import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("basket action ownership", () => {
  it("keeps mint and redemption builders on Basket detail only", () => {
    const basketDetail = read("components/baskets/BasketDetailPage.tsx");
    const positionDetail = read("components/positions/PositionDetailPage.tsx");

    expect(basketDetail).toContain("buildMintCall");
    expect(basketDetail).toContain("buildMintBasketCollateralCall");
    expect(basketDetail).toContain("buildCreateAndMintBasketCollateralCall");
    expect(basketDetail).toContain("buildRedeemCall");
    expect(basketDetail).toContain("buildRedeemBasketCollateralCall");

    expect(positionDetail).not.toContain("buildMintCall");
    expect(positionDetail).not.toContain("buildMintBasketCollateralCall");
    expect(positionDetail).not.toContain("buildRedeemCall");
    expect(positionDetail).not.toContain("buildRedeemBasketCollateralCall");
  });

  it("links position conversion intents back to the canonical Basket surface", () => {
    const positionDetail = read("components/positions/PositionDetailPage.tsx");

    expect(positionDetail).toContain("?action=mint&positionId=");
    expect(positionDetail).toContain("?action=redeem&positionId=");
  });

  it("describes basket creation as minting in transaction activity", () => {
    const basketDetail = read("components/baskets/BasketDetailPage.tsx");

    expect(basketDetail).toContain("`Mint ${basket.symbol}`");
    expect(basketDetail).toContain("`Mint and deposit ${basket.symbol}`");
    expect(basketDetail).not.toContain("`Buy ${basket.symbol}`");
    expect(basketDetail).not.toContain("`Buy and deposit ${basket.symbol}`");
  });
});
