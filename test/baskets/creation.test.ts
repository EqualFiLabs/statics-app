import { describe, expect, it } from "vitest";

import { getDappRoutePresentation } from "@/lib/dapp-navigation";

describe("basket creation route", () => {
  it("advertises a permissionless creator-revenue launch", () => {
    expect(getDappRoutePresentation("/app/create")).toEqual({
      label: "Create basket",
      status: "Create",
      title: "Launch an index basket",
      description:
        "Choose a fixed asset bundle, fund its trading pools, and earn the creator share of its swap fees.",
    });
  });
});
