import { test } from "node:test";
import assert from "node:assert/strict";
import { getSqrtPriceAtTick, quoteRangeAmounts } from "@statics-protocol/sdk";
import {
  encodeEventTopics,
  encodeAbiParameters,
  parseAbi,
  parseAbiParameters,
  zeroAddress,
} from "viem";
import { fixturePrice, seedLiquidity, snapshotMarket, verifyFixture } from "./market-fixture.mjs";

const key = {
  currency0: "0x0000000000000000000000000000000000000001",
  currency1: "0x0000000000000000000000000000000000000002",
};
const price = getSqrtPriceAtTick(122110);
test("Doppler atomic price preserves decimals and handles reversed currencies exactly", () => {
  assert.equal(fixturePrice(key, key, price), price);
  assert.equal(
    fixturePrice(key, { currency0: key.currency1, currency1: key.currency0 }, price),
    (1n << 192n) / price
  );
  assert.throws(() => fixturePrice(key, key, 0n), /no 1:1 fallback/);
  assert.throws(() => fixturePrice(key, { ...key, currency1: "wrong" }, price), /do not match/);
});
test("realistic market seed is centered on current tick and fits both fixture balances", () => {
  for (const tick of [122110, -122110, 0, 887200, -887200]) {
    const p = getSqrtPriceAtTick(tick);
    const seed = seedLiquidity(p, 60, 10n ** 18n, 200000n * 10n ** 18n);
    assert.ok(seed.tickLower <= tick && seed.tickUpper > tick);
    assert.equal(seed.tickLower % 60 || 0, 0);
    assert.equal(seed.tickUpper % 60 || 0, 0);
    const amounts = quoteRangeAmounts(p, seed.tickLower, seed.tickUpper, seed.liquidity);
    assert.ok(amounts.amount0 <= 10n ** 18n && amounts.amount1 <= 200000n * 10n ** 18n);
  }
  assert.throws(() => seedLiquidity(price, 60, 0n, 1n), /funded/);
});
test("snapshot price ignores later market moves and verification checks initialization history read-only", async () => {
  const snapshot = { number: "100", hash: "0xabc" };
  const calls = [];
  const poolId = "0x" + "12".repeat(32),
    hash = "0x" + "34".repeat(32);
  const initializeAbi = parseAbi([
    "event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)",
  ]);
  const receipt = {
    status: "success",
    blockNumber: 110n,
    transactionHash: hash,
    logs: [
      {
        address: key.currency0,
        topics: encodeEventTopics({
          abi: initializeAbi,
          eventName: "Initialize",
          args: { id: poolId, currency0: key.currency0, currency1: key.currency1 },
        }),
        data: encodeAbiParameters(parseAbiParameters("uint24,int24,address,uint160,int24"), [
          3000,
          60,
          zeroAddress,
          price,
          122110,
        ]),
      },
    ],
  };
  const client = {
    getTransactionReceipt: async () => receipt,
    getBlock: async ({ blockNumber }) => {
      assert.equal(blockNumber, 100n);
      return { hash: "0xabc" };
    },
    readContract: async (request) => {
      calls.push(request);
      if (request.functionName === "decimals") return request.address === key.currency0 ? 18 : 6;
      assert.ok(request.blockNumber === 100n || request.blockNumber === 110n);
      return [price, 122110, 0, 15000];
    },
  };
  const launch = {
    contracts: { stateView: { address: key.currency0 }, poolManager: { address: key.currency0 } },
    market: { poolId: "canonical", poolKey: key },
  };
  const marketFixture = await snapshotMarket(client, launch, snapshot, key);
  assert.equal(marketFixture.sqrtPriceX96, String(price));
  assert.deepEqual(marketFixture.decimals, [18, 6]);
  const profile = {
    snapshot,
    marketFixture,
    pool: { poolKey: key, poolId, registrationBlock: "110", creationTransactionHash: hash },
  };
  await verifyFixture(client, launch, profile);
  await assert.rejects(
    () =>
      verifyFixture(
        { ...client, getTransactionReceipt: async () => ({ ...receipt, status: "reverted" }) },
        launch,
        profile
      ),
    /receipt failed/
  );
  await verifyFixture(
    {
      ...client,
      getTransactionReceipt: async () => {
        throw Error("Pruned receipt");
      },
    },
    launch,
    profile,
    client,
    receipt
  );
  assert.ok(calls.every((request) => ["getSlot0", "decimals"].includes(request.functionName)));
  await assert.rejects(
    () => verifyFixture(client, launch, { ...profile, marketFixture: null }),
    /Legacy fixture/
  );
  await assert.rejects(
    () =>
      verifyFixture(client, launch, {
        ...profile,
        marketFixture: { ...marketFixture, sqrtPriceX96: String(1n << 96n) },
      }),
    /provenance mismatch/
  );
  await assert.rejects(
    () =>
      snapshotMarket(
        { ...client, getBlock: async () => ({ hash: "0xdef" }) },
        launch,
        snapshot,
        key
      ),
    /boundary changed/
  );
});
