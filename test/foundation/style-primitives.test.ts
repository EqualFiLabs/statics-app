import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migratedSurfaces = [
  "components/baskets/BasketCreatePage.tsx",
  "components/genesis/GenesisPage.tsx",
  "components/rewards/ProtocolRevenueCard.tsx",
] as const;

describe("DApp style primitives", () => {
  it("uses the shared card primitive instead of the undefined dapp-card class", () => {
    for (const file of migratedSurfaces) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("dapp-card");
      expect(source, file).toContain("ui-card");
    }
  });

  it("composes the Genesis cards from the shared UI primitives", () => {
    const source = readFileSync("components/genesis/GenesisPage.tsx", "utf8");
    for (const primitive of ["ui-stat", "ui-section-title", "ui-pill", "ui-field", "ui-button"]) {
      expect(source).toContain(primitive);
    }
  });

  it("keeps the centred trade card layout scoped away from Wallet", () => {
    const source = readFileSync("app/(dapp)/app/app.css", "utf8");

    expect(source).toContain(".wallet-surface,\n.portal-workspace {");
    expect(source).toContain(
      ".swap-page {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);"
    );
    expect(source).not.toContain(".wallet-surface,\n.portal-workspace,\n.swap-page {");
  });
});
