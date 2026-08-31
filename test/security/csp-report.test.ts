import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST, resetCspReportLimiterForTests } from "@/app/api/security/csp-report/route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://staticsprotocol.com/api/security/csp-report", {
    method: "POST",
    headers: { "content-type": "application/csp-report", ...headers },
    body: JSON.stringify(body),
  });
}

describe("CSP report collection", () => {
  beforeEach(() => resetCspReportLimiterForTests());

  it("logs only normalized legacy fields without URL secrets", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await POST(
      request({
        "csp-report": {
          "document-uri": "https://staticsprotocol.com/app?token=secret#fragment",
          "blocked-uri": "https://evil.example/payload.js?wallet=secret",
          "effective-directive": "script-src-elem",
          "violated-directive": "script-src-elem",
          "source-file": "chrome-extension://secret/inject.js",
          "status-code": 200,
          "script-sample": "wallet signature should never be logged",
        },
      })
    );
    expect(result.status).toBe(204);
    const log = warning.mock.calls[0]?.[0] as string;
    expect(log).toContain('"event":"csp_violation"');
    expect(log).toContain("https://staticsprotocol.com/app");
    expect(log).toContain("browser-extension:");
    expect(log).not.toContain("secret");
    expect(log).not.toContain("signature");
    warning.mockRestore();
  });

  it("accepts bounded Reporting API batches", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await POST(
      request(
        [
          {
            type: "csp-violation",
            url: "https://staticsprotocol.com/app",
            body: { effectiveDirective: "img-src", blockedURL: "data:image/svg+xml,hidden" },
          },
        ],
        { "content-type": "application/reports+json" }
      )
    );
    expect(result.status).toBe(204);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0]?.[0]).toContain('"blockedURL":"data:"');
    warning.mockRestore();
  });

  it("rejects unsupported, malformed, and oversized bodies", async () => {
    expect(await POST(request({}, { "content-type": "text/plain" }))).toMatchObject({
      status: 415,
    });
    expect(
      await POST(
        new Request("https://staticsprotocol.com/api/security/csp-report", {
          method: "POST",
          headers: { "content-type": "application/csp-report" },
          body: "not-json",
        })
      )
    ).toMatchObject({ status: 400 });
    expect(
      await POST(
        request(
          { "csp-report": { "document-uri": "https://staticsprotocol.com" } },
          { "content-length": String(16 * 1024 + 1) }
        )
      )
    ).toMatchObject({ status: 413 });
  });

  it("bounds per-client report volume", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const payload = { "csp-report": { "document-uri": "https://staticsprotocol.com/app" } };
    for (let index = 0; index < 30; index += 1) {
      expect((await POST(request(payload, { "x-forwarded-for": "192.0.2.1" }))).status).toBe(204);
    }
    expect((await POST(request(payload, { "x-forwarded-for": "192.0.2.1" }))).status).toBe(429);
    warning.mockRestore();
  });
});
