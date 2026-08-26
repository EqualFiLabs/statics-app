import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadRecoverableGenesisCredits,
  loadRecoverableLoanIds,
  loadNextAvailableGenesisId,
  loadWalletLaunchGenesisIds,
  loadWalletGenesis,
  loadWalletV4PositionIds,
} from "@/lib/indexer/statics";

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

  it("loads indexed Genesis activation and link state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [{ id: "420", tier: 3, multiplierBps: 12_000, linkedPositionId: "9" }],
            nextCursor: null,
          })
        )
      )
    );
    await expect(loadWalletGenesis(wallet, "https://indexer.example")).resolves.toEqual([
      {
        id: 420n,
        tier: 3,
        multiplierBps: 12_000,
        linkedPositionId: 9n,
      },
    ]);
  });

  it("requires launch responses to match the selected deployment", async () => {
    const fetch = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            deploymentId: "robinhood-genesis",
            tokenId: "42",
          })
        )
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      loadNextAvailableGenesisId("robinhood-genesis", "https://mainnet-indexer.example")
    ).resolves.toEqual(42n);
    await expect(
      loadWalletLaunchGenesisIds(wallet, "wrong-deployment", "https://mainnet-indexer.example")
    ).rejects.toThrow("different deployment");
  });

  it("loads deployment-scoped recoverable Genesis credit pages", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            deploymentId: "robinhood-genesis",
            items: [
              {
                genesisId: "42",
                owner: wallet,
                principal: "1000",
                maturity: "2000",
                recoverableAt: "2060",
              },
            ],
            nextCursor: "next",
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            deploymentId: "robinhood-genesis",
            items: [],
            nextCursor: null,
          })
        )
      );
    vi.stubGlobal("fetch", fetch);

    await expect(
      loadRecoverableGenesisCredits(3_000n, "robinhood-genesis", "https://indexer.example")
    ).resolves.toEqual([
      {
        genesisId: 42n,
        owner: wallet,
        principal: 1_000n,
        maturity: 2_000n,
        recoverableAt: 2_060n,
      },
    ]);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("asOf=3000");
    expect(String(fetch.mock.calls[0]?.[0])).toContain("limit=100");
    expect(String(fetch.mock.calls[1]?.[0])).toContain("cursor=next");
  });

  it("checksums recoverable credit owners", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            deploymentId: "robinhood-genesis",
            items: [
              {
                genesisId: "1",
                owner: "0xde709f2102306220921060314715629080e2fb77",
                principal: "1",
                maturity: "2",
                recoverableAt: "3",
              },
            ],
            nextCursor: null,
          })
        )
      )
    );
    const [credit] = await loadRecoverableGenesisCredits(
      100n,
      "robinhood-genesis",
      "https://indexer.example"
    );
    expect(credit?.owner).toBe("0xde709f2102306220921060314715629080e2fb77");
  });
  it.each([
    [
      "deployment mismatch",
      { deploymentId: "other", items: [], nextCursor: null },
      "different deployment",
    ],
    [
      "malformed address",
      {
        deploymentId: "robinhood-genesis",
        items: [
          {
            genesisId: "1",
            owner: "not-an-address",
            principal: "1",
            maturity: "2",
            recoverableAt: "3",
          },
        ],
        nextCursor: null,
      },
      "invalid Genesis credit owner",
    ],
    [
      "malformed bigint",
      {
        deploymentId: "robinhood-genesis",
        items: [
          {
            genesisId: "1",
            owner: wallet,
            principal: "nope",
            maturity: "2",
            recoverableAt: "3",
          },
        ],
        nextCursor: null,
      },
      "invalid ID",
    ],
  ])("rejects recoverable credit %s", async (_name, body, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    await expect(
      loadRecoverableGenesisCredits(100n, "robinhood-genesis", "https://indexer.example")
    ).rejects.toThrow(message);
  });

  it("rejects a stalled recoverable-credit cursor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              deploymentId: "robinhood-genesis",
              items: [],
              nextCursor: "same",
            })
          )
      )
    );
    await expect(
      loadRecoverableGenesisCredits(100n, "robinhood-genesis", "https://indexer.example")
    ).rejects.toThrow("stalled cursor");
  });

  it("requires a configured deployment indexer for recoverable credits", async () => {
    await expect(loadRecoverableGenesisCredits(100n, "unconfigured", null)).rejects.toThrow(
      "No indexer is configured"
    );
  });
});
