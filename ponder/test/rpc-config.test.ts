import { afterEach, describe, expect, it, vi } from "vitest";

import { rpcUrlsForChain } from "../src/rpc-config";

describe("Ponder RPC configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses a comma-separated provider pool when configured", () => {
    vi.stubEnv("PONDER_RPC_URLS_4663", "https://primary.example, https://secondary.example");
    vi.stubEnv("PONDER_RPC_URL_4663", "https://fallback.example");

    expect(rpcUrlsForChain(4_663)).toEqual([
      "https://primary.example",
      "https://secondary.example",
    ]);
  });

  it("retains the singular provider configuration", () => {
    vi.stubEnv("PONDER_RPC_URL_4663", "https://primary.example");

    expect(rpcUrlsForChain(4_663)).toBe("https://primary.example");
  });
});
