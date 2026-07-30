import { describe, expect, it } from "vitest";

import { readDollarProfile } from "@/lib/dollar/profile-navigation";

describe("Dollar profile navigation", () => {
  it.each(["ETH", "WETH", "USDG"] as const)("accepts the %s profile", (profile) => {
    expect(readDollarProfile(profile)).toBe(profile);
  });

  it("defaults malformed or repeated query values to ETH", () => {
    expect(readDollarProfile("usdG")).toBe("ETH");
    expect(readDollarProfile(["USDG", "WETH"])).toBe("ETH");
    expect(readDollarProfile(undefined)).toBe("ETH");
  });
});
