import { describe, expect, it } from "vitest";

import { getDappRoutePresentation } from "@/lib/dapp-navigation";

describe("DApp route presentation", () => {
  it.each([
    ["/app", "Overview", "Track your Statics portfolio."],
    ["/app/dollar", "Dollar", "Issue and redeem Statics Dollar."],
    ["/app/baskets", "Baskets", "Inspect, mint, and redeem static baskets."],
    ["/app/positions", "Positions", "Manage each wallet-owned PositionNFT."],
    ["/app/rewards", "Rewards", "Create stake positions with selected rewards."],
    ["/app/activity", "Activity", "Review protocol activity."],
    ["/app/settings", "Settings", "Manage your Statics wallet."],
  ])("selects %s presentation", (pathname, label, title) => {
    expect(getDappRoutePresentation(pathname)).toMatchObject({ label, title });
  });

  it("inherits parent presentation for detail routes", () => {
    expect(getDappRoutePresentation("/app/baskets/42").label).toBe("Baskets");
    expect(getDappRoutePresentation("/app/positions/1042").label).toBe("Positions");
  });

  it("falls back to overview for an unknown application route", () => {
    expect(getDappRoutePresentation("/app/unknown").label).toBe("Overview");
  });
});
