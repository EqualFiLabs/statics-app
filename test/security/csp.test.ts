import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildContentSecurityPolicy,
  cspResponseHeader,
  readCspConfiguration,
} from "@/lib/security/csp";

describe("content security policy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults production to report-only and keeps sources explicit", () => {
    const configuration = readCspConfiguration({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_ENV: "production",
    });
    expect(configuration.mode).toBe("report-only");
    const policy = buildContentSecurityPolicy("abc123==", configuration);
    expect(policy).toContain("script-src 'self' 'nonce-abc123==' 'strict-dynamic'");
    expect(policy).toContain("img-src 'self' data: blob:");
    expect(policy).toContain("https://auth.privy.io");
    expect(policy).toContain("wss://relay.walletconnect.com");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toMatch(/(?:^| )https:(?: |;)/);
    expect(policy).not.toMatch(/(?:^| )wss:(?: |;)/);
  });

  it("adds only the selected CAPTCHA and validated custom origins", () => {
    const policy = buildContentSecurityPolicy(
      "nonce",
      readCspConfiguration({
        NODE_ENV: "production",
        STATICS_CSP_MODE: "enforce",
        STATICS_CSP_CAPTCHA_PROVIDER: "turnstile",
        STATICS_PRIVY_AUTH_ORIGIN: "https://privy.staticsprotocol.com",
        NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL: "https://solana.example/rpc?public=1",
      })
    );
    expect(policy).toContain("https://challenges.cloudflare.com");
    expect(policy).toContain("https://privy.staticsprotocol.com");
    expect(policy).toContain("https://solana.example");
    expect(policy).not.toContain("hcaptcha.com");
  });

  it("rejects malformed modes and origins", () => {
    expect(() => readCspConfiguration({ STATICS_CSP_MODE: "maybe" })).toThrow("STATICS_CSP_MODE");
    expect(() =>
      readCspConfiguration({ STATICS_PRIVY_AUTH_ORIGIN: "https://privy.example/path" })
    ).toThrow("without a path");
    expect(() =>
      readCspConfiguration({ NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL: "http://solana.example" })
    ).toThrow("credential-free HTTPS");
  });

  it("selects exactly one response header", () => {
    expect(cspResponseHeader("off")).toBeNull();
    expect(cspResponseHeader("report-only")).toBe("Content-Security-Policy-Report-Only");
    expect(cspResponseHeader("enforce")).toBe("Content-Security-Policy");
  });
});
