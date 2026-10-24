// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyAgent } from "@/lib/server/agent-proxy";
const headers = {
  authorization: "Bearer user",
  "x-agent-app": "forged-app",
  "x-agent-app-key": "forged",
  "x-agent-wallet": "0x123",
};
function configure() {
  vi.stubEnv("NEXT_PUBLIC_AGENT_ENABLED", "true");
  vi.stubEnv("AGENT_SERVICE_URL", "http://127.0.0.1:4310");
  vi.stubEnv("AGENT_APP_CONNECTION_KEY", "server-secret");
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("agent BFF", () => {
  it("fails closed while disabled and without authenticated user", async () => {
    expect(
      (await proxyAgent(new Request("http://localhost/api/agent/v1/actions"), ["v1", "actions"]))
        .status
    ).toBe(404);
    configure();
    expect(
      (await proxyAgent(new Request("http://localhost/api/agent/v1/actions"), ["v1", "actions"]))
        .status
    ).toBe(401);
  });
  it("binds the app server identity and forwards opaque action references", async () => {
    configure();
    const fetcher = vi.fn(async () => Response.json({ id: "canonical" }));
    vi.stubGlobal("fetch", fetcher);
    const response = await proxyAgent(
      new Request("http://localhost/api/agent/v1/actions", { headers }),
      ["v1", "actions"]
    );
    expect(await response.json()).toEqual({ id: "canonical" });
    const options = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(options[1].headers).toMatchObject({
      "x-agent-app": "statics",
      "x-agent-app-key": "server-secret",
      authorization: "Bearer user",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(await response.json().catch(() => null))).not.toContain("server-secret");
  });
  it("rejects path traversal, oversized bodies and an insecure remote service", async () => {
    configure();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(
      (
        await proxyAgent(new Request("http://localhost/api/agent", { headers }), [
          "v1",
          "..",
          "admin",
        ])
      ).status
    ).toBe(404);
    expect(
      (
        await proxyAgent(
          new Request("http://localhost/api/agent", {
            headers,
            method: "POST",
            body: "x".repeat(262145),
          }),
          ["v1", "actions"]
        )
      ).status
    ).toBe(413);
    vi.stubEnv("AGENT_SERVICE_URL", "http://public.example");
    expect(
      (await proxyAgent(new Request("http://localhost/api/agent", { headers }), ["v1", "actions"]))
        .status
    ).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps interrupted responses recoverable without exposing upstream errors", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("secret upstream URL");
      })
    );
    const response = await proxyAgent(new Request("http://localhost/api/agent", { headers }), [
      "v1",
      "actions",
    ]);
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("Check activity");
  });
});
