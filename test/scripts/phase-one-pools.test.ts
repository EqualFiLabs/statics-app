import { describe, expect, it, vi } from "vitest";
import { v4PoolId } from "@statics-protocol/sdk/phase-one";

import { addPools, listIndexedPools, unlistedPools } from "../../scripts/lib/phase-one-pools.mjs";

const address = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as const;
const poolId = (n: number) => v4PoolId(key(address(n)));
const weth = {
  address: address(6),
  name: "Wrapped Ether",
  symbol: "WETH",
  decimals: 18,
  logoUri: "/weth.svg",
};
const key = (currency1: `0x${string}`) => ({
  currency0: address(6),
  currency1,
  fee: 3000,
  tickSpacing: 60,
  hooks: address(3),
});
const manifest = {
  deploymentId: "local",
  deploymentStartBlock: "1",
  contracts: { publicHook: { address: address(3) } },
  supportedPools: [
    {
      poolId: poolId(7),
      poolKey: key(address(7)),
      token0: weth,
      token1: { address: address(7), name: "Statics", symbol: "STATICS", decimals: 18 },
      enabled: true,
      registrationBlock: "1",
    },
  ],
};
const indexed = [
  {
    poolId: poolId(8),
    poolKey: key(address(8)),
    createdAtBlock: "40",
    token0: { address: address(6), name: "WETH", symbol: "WETH", decimals: 18 },
    token1: { address: address(8), name: "Meta", symbol: "META", decimals: 18 },
  },
];

describe("adding Phase 1 pools", () => {
  it("adds a named pool, keeping curated metadata for listed tokens", () => {
    const updated = addPools(manifest, [poolId(8)], indexed);
    expect(updated.supportedPools.at(-1)).toEqual({
      poolKey: key(address(8)),
      poolId: poolId(8),
      registrationBlock: "40",
      token0: weth,
      token1: { address: address(8), name: "Meta", symbol: "META", decimals: 18 },
      enabled: true,
    });
  });

  it("lists indexed pools the manifest does not have", () => {
    expect(
      unlistedPools(manifest, [{ ...indexed[0]!, poolId: poolId(7) }, ...indexed]).map(
        (pool) => pool.poolId
      )
    ).toEqual([poolId(8)]);
  });

  it("refuses pools that are already listed or not indexed", () => {
    expect(() => addPools(manifest, [poolId(7)], indexed)).toThrow("already in the manifest");
    expect(() => addPools(manifest, [poolId(9)], indexed)).toThrow("not an indexed");
  });

  it("pages the indexer directory", async () => {
    const page = (items: unknown[], nextCursor: string | null) =>
      new Response(JSON.stringify({ deploymentId: "local", items, nextCursor }));
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([{ poolId: "0x1" }], "next"))
      .mockResolvedValueOnce(page([{ poolId: "0x2" }], null));
    const pools = await listIndexedPools({
      indexerUrl: "http://i/",
      deploymentId: "local",
      fetch: fetchPage,
    });
    expect(pools.map((pool) => pool.poolId)).toEqual(["0x1", "0x2"]);
    expect(fetchPage.mock.calls[1]![0]).toContain("cursor=next");
  });
});

it("rejects duplicate requests, foreign keys and incomplete metadata without changing inputs", () => {
  const before = structuredClone(manifest);
  expect(() => addPools(manifest, [poolId(8), poolId(8)], indexed)).toThrow("Duplicate");
  for (const changed of [
    { ...indexed[0]!, poolKey: { ...key(address(8)), hooks: address(4) } },
    { ...indexed[0]!, poolKey: { ...key(address(8)), fee: 100 } },
    { ...indexed[0]!, token1: { ...indexed[0]!.token1, decimals: null } },
    { ...indexed[0]!, createdAtBlock: "0" },
  ])
    expect(() => addPools(manifest, [poolId(8)], [changed] as typeof indexed)).toThrow();
  expect(manifest).toEqual(before);
});
it("rejects foreign deployments and repeated pagination cursors", async () => {
  const foreign = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ deploymentId: "other", items: [], nextCursor: null }))
    );
  await expect(
    listIndexedPools({ indexerUrl: "http://i", deploymentId: "local", fetch: foreign })
  ).rejects.toThrow("invalid pool directory");
  const repeating = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response(JSON.stringify({ deploymentId: "local", items: [], nextCursor: "same" }))
    );
  await expect(
    listIndexedPools({ indexerUrl: "http://i", deploymentId: "local", fetch: repeating })
  ).rejects.toThrow("repeated");
});
