import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("loan action ownership", () => {
  it("keeps every loan origination destination on Loans", () => {
    const loans = read("components/loans/LoansPage.tsx");
    const liquidity = read("components/liquidity/LiquidityPage.tsx");
    const loanModel = read("lib/loans/loans.ts");

    expect(loans).toContain("buildBorrowCall");
    expect(loans).toContain("buildBorrowAndProvideLiquidityCall");
    expect(loanModel).toContain('type BorrowDestination = "wallet" | "liquidity"');
    expect(liquidity).not.toContain("buildBorrowCall");
    expect(liquidity).not.toContain("buildBorrowAndProvideLiquidityCall");
    expect(liquidity).not.toContain('"borrow-liquidity"');
  });
});
