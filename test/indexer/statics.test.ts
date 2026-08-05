import { afterEach, describe, expect, it, vi } from "vitest";

import { loadRecoverableLoanIds, loadWalletV4PositionIds } from "@/lib/indexer/statics";

const wallet = "0x0000000000000000000000000000000000000001" as const;

describe("Statics indexer client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("follows opaque cursors and parses bigint IDs", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{ id: "1" }], nextCursor: "next" }))
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{ id: "2" }], nextCursor: null }))
      );
    vi.stubGlobal("fetch", fetch);

    await expect(loadRecoverableLoanIds(100n, "https://indexer.example")).resolves.toEqual([
      1n,
      2n,
    ]);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("asOf=100");
    expect(String(fetch.mock.calls[1]?.[0])).toContain("cursor=next");
  });

  it("uses the checksummed wallet path for v4 positions", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ items: [{ id: "9" }], nextCursor: null })));
    vi.stubGlobal("fetch", fetch);

    await expect(loadWalletV4PositionIds(wallet, "https://indexer.example")).resolves.toEqual([9n]);
    expect(String(fetch.mock.calls[0]?.[0])).toContain(`/wallets/${wallet}/v4-positions`);
  });

  it("rejects malformed pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ items: [{ id: "nope" }], nextCursor: null }))
        )
    );

    await expect(loadRecoverableLoanIds(100n, "https://indexer.example")).rejects.toThrow(
      "invalid ID"
    );
  });
});
