import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/rpc/[chainId]/route";

const upstream = "https://rpc.example/v2/private-key";

function request(payload: unknown) {
  return new Request("http://localhost/api/rpc/4663", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost",
      origin: "http://localhost",
    },
    body: JSON.stringify(payload),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Robinhood RPC read proxy", () => {
  it("continues to reject signed transaction broadcasts", async () => {
    vi.stubEnv("STATICS_ROBINHOOD_MAINNET_RPC_URL", upstream);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const response = await POST(
      request({ id: 1, jsonrpc: "2.0", method: "eth_sendRawTransaction", params: ["0x01"] }),
      { params: Promise.resolve({ chainId: "4663" }) }
    );

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards Retry-After and logs only sanitized request metadata", async () => {
    vi.stubEnv("STATICS_ROBINHOOD_MAINNET_RPC_URL", upstream);
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 429, message: "rate limited" } }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "2" },
      })
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetch);
    const sensitiveAddress = "0x1111111111111111111111111111111111111111";

    const response = await POST(
      request({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ data: "0x12345678", to: sensitiveAddress }, "latest"],
      }),
      { params: Promise.resolve({ chainId: "4663" }) }
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("2");
    expect(fetch).toHaveBeenCalledWith(
      upstream,
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
    expect(warn).toHaveBeenCalledWith("Robinhood RPC upstream request failed", {
      batchSize: 1,
      chainId: 4_663,
      durationMs: expect.any(Number),
      methods: ["eth_call"],
      retryAfter: true,
      status: 429,
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(sensitiveAddress);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("0x12345678");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-key");
  });

  it("reports an upstream transport failure without logging the request body", async () => {
    vi.stubEnv("STATICS_ROBINHOOD_MAINNET_RPC_URL", upstream);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("provider unavailable")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await POST(
      request({ id: 2, jsonrpc: "2.0", method: "eth_getCode", params: ["0xsecret", "latest"] }),
      { params: Promise.resolve({ chainId: "4663" }) }
    );

    expect(response.status).toBe(502);
    expect(warn).toHaveBeenCalledWith(
      "Robinhood RPC upstream request failed",
      expect.objectContaining({ methods: ["eth_getCode"], status: 502 })
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("0xsecret");
  });
});
