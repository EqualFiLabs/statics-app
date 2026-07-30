import { describe, expect, it } from "vitest";

import { portalRequested, walletPortalUrl, withoutWalletPortal } from "@/lib/portal/navigation";

describe("wallet Portal navigation", () => {
  it("opens the canonical wallet modal without dropping other presentation state", () => {
    expect(walletPortalUrl("/app/wallet", "?tab=tokens")).toBe(
      "/app/wallet?tab=tokens&modal=portal"
    );
  });

  it("closes only the Portal modal state", () => {
    expect(withoutWalletPortal("/app/wallet", "?modal=portal&tab=tokens")).toBe(
      "/app/wallet?tab=tokens"
    );
    expect(portalRequested("?modal=portal")).toBe(true);
    expect(portalRequested("?modal=send")).toBe(false);
  });
});
