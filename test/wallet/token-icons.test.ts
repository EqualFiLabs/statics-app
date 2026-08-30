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
