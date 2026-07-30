import { describe, expect, it } from "vitest";

import { getDappRoutePresentation, isDappOverviewPath } from "@/lib/dapp-navigation";

describe("DApp route presentation", () => {
  it("shows the shared summary only on the overview route", () => {
    expect(isDappOverviewPath("/app")).toBe(true);
    expect(isDappOverviewPath("/app/")).toBe(true);
    expect(isDappOverviewPath("/app/wallet")).toBe(false);
    expect(isDappOverviewPath("/app/baskets/1042")).toBe(false);
  });

  it.each([
    ["/app", "Overview", "Your portfolio"],
    ["/app/wallet", "Wallet", "Your wallet"],
    ["/app/portal", "Add funds", "Add funds to Statics"],
    ["/app/dollar", "Dollar", "Get Statics Dollar"],
    ["/app/baskets", "Baskets", "Baskets"],
    ["/app/create", "Launch policy", "Basket launch policy"],
    ["/app/positions", "Positions", "Your positions"],
    ["/app/loans", "Loans", "Your loans"],
    ["/app/rewards", "Rewards", "Your rewards"],
    ["/app/liquidity", "Liquidity", "Provide liquidity"],
    ["/app/activity", "Activity", "Your activity"],
    ["/app/tools", "Tools", "Approval tools"],
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
