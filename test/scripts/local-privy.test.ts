import { describe, expect, it } from "vitest";

import {
  mergePublicPrivyConfig,
  readPublicPrivyConfig,
  requirePublicPrivySource,
} from "../../scripts/lib/local-privy.mjs";

describe("local Privy public configuration", () => {
  it("requires callers to name the source environment explicitly", () => {
    expect(requirePublicPrivySource(" /tmp/public.env ")).toBe("/tmp/public.env");
    expect(() => requirePublicPrivySource(undefined)).toThrow("EVES_MARKET_ENV_PATH");
  });

  it("reads only the approved public identifiers", () => {
    expect(
      readPublicPrivyConfig(`
NEXT_PUBLIC_PRIVY_APP_ID="shared-app"
NEXT_PUBLIC_PRIVY_CLIENT_ID='shared-client'
PRIVY_APP_SECRET=must-not-cross
PRIVY_AUTHORIZATION_PRIVATE_KEY=must-not-cross
`)
    ).toEqual({
      appId: "shared-app",
      clientId: "shared-client",
    });
  });

  it("requires the shared public app identifier without exposing values", () => {
    expect(() => readPublicPrivyConfig("PRIVY_APP_SECRET=server-secret\n")).toThrow(
      "NEXT_PUBLIC_PRIVY_APP_ID is missing"
    );
  });

  it("updates only the two public Privy entries and preserves local settings", () => {
    const merged = mergePublicPrivyConfig(
      [
        "NEXT_PUBLIC_APP_ENV=development",
        "NEXT_PUBLIC_PRIVY_APP_ID=old-app",
        "NEXT_PUBLIC_PRIVY_CLIENT_ID=old-client",
        "LOCAL_ONLY=value",
        "",
      ].join("\n"),
      { appId: "shared-app" }
    );

    expect(merged).toBe(
      [
        "NEXT_PUBLIC_APP_ENV=development",
        "NEXT_PUBLIC_PRIVY_APP_ID=shared-app",
        "LOCAL_ONLY=value",
        "",
      ].join("\n")
    );
    expect(merged).not.toContain("old-client");
  });

  it("adds the optional client identifier when Eves provides it", () => {
    expect(
      mergePublicPrivyConfig("", {
        appId: "shared-app",
        clientId: "shared-client",
      })
    ).toBe("NEXT_PUBLIC_PRIVY_APP_ID=shared-app\nNEXT_PUBLIC_PRIVY_CLIENT_ID=shared-client\n");
  });
});
