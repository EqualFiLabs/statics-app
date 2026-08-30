import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "@/proxy";

function nonceFrom(policy: string): string {
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
  if (!nonce) throw new Error("Policy has no nonce.");
  return nonce;
}

describe("security proxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("generates a unique report-only nonce per document response", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STATICS_CSP_MODE", "report-only");
    const first = proxy(new NextRequest("https://staticsprotocol.com/app"));
    const second = proxy(new NextRequest("https://staticsprotocol.com/app"));
    const firstPolicy = first.headers.get("content-security-policy-report-only")!;
    const secondPolicy = second.headers.get("content-security-policy-report-only")!;
    expect(firstPolicy).toContain("report-uri /api/security/csp-report");
    expect(first.headers.get("content-security-policy")).toBeNull();
    expect(first.headers.get("reporting-endpoints")).toBe('statics-csp="/api/security/csp-report"');
    expect(nonceFrom(firstPolicy)).not.toBe(nonceFrom(secondPolicy));
  });

  it("can enforce or disable the policy without changing source", () => {
    vi.stubEnv("STATICS_CSP_MODE", "enforce");
    expect(
      proxy(new NextRequest("https://staticsprotocol.com/")).headers.get("content-security-policy")
    ).toBeTruthy();
    vi.stubEnv("STATICS_CSP_MODE", "off");
    expect(
      proxy(new NextRequest("https://staticsprotocol.com/")).headers.get("content-security-policy")
    ).toBeNull();
  });

  it("excludes APIs and static assets from document nonce processing", () => {
    const source = config.matcher[0].source;
    expect(source).toContain("api");
    expect(source).toContain("_next/static");
    expect(source).toContain("assets");
    expect(source).toContain("icons");
  });
});
