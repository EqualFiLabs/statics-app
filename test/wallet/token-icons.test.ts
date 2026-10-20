import { describe, expect, it } from "vitest";

import { allowedTokenLogoURI, ETH_TOKEN_ICON_URI } from "@/lib/token-icons";

describe("local token artwork", () => {
  it("allows only generated token assets and owned icon paths", () => {
    expect(allowedTokenLogoURI(ETH_TOKEN_ICON_URI)).toBe(ETH_TOKEN_ICON_URI);
    expect(allowedTokenLogoURI("/assets/token-logos/v1/example.webp")).toBe(
      "/assets/token-logos/v1/example.webp"
    );
    expect(allowedTokenLogoURI("/api/security/csp-report")).toBeNull();
    expect(allowedTokenLogoURI("//untrusted.example/logo.svg")).toBeNull();
  });

  it("maps catalog sources to checked-in files without returning the remote URL", () => {
    const remote = "https://arbitrum.foundation/logo.png";
    const local = allowedTokenLogoURI(remote);
    expect(local).toMatch(/^\/assets\/token-logos\/v1\/[a-f0-9]{64}\.webp$/);
    expect(local).not.toBe(remote);
  });
});

describe("token letter badges", () => {
  it("gives a token the same colour every time, whatever the address case", async () => {
    const { tokenBadgeTone } = await import("@/components/wallet/TokenLogo");
    const tone = tokenBadgeTone("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73");
    expect(tone).toBe(tokenBadgeTone("0x0bd7d308f8e1639fab988df18a8011f41eacad73"));
    expect(tone).toBeGreaterThanOrEqual(0);
    expect(tone).toBeLessThan(12);
  });
});

describe("reviewed per-chain token logos", () => {
  it("matches Robinhood tokens by chain and address, never by symbol or another chain", async () => {
    const { chainTokenLogoURI } = await import("@/lib/token-icons");
    const usdg = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
    expect(allowedTokenLogoURI(chainTokenLogoURI(4663, usdg))).toMatch(/^\/assets\/token-logos\//);
    expect(chainTokenLogoURI(4663, usdg.toLowerCase())).toBe(chainTokenLogoURI(4663, usdg));
    expect(chainTokenLogoURI(1, usdg)).toBeUndefined();
    expect(chainTokenLogoURI(4663, `0x${"1".repeat(40)}`)).toBeUndefined();
  });
});
