import assert from "node:assert/strict";
import { erc20Abi, parseEventLogs, parseAbi } from "viem";
import {
  getSqrtPriceAtTick,
  maximumLiquidityForAmounts,
  quoteRangeAmounts,
  v4StateViewReadAbi,
} from "@statics-protocol/sdk";

export const fixtureVersion = "doppler-snapshot-v1";
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

// sqrtPriceX96 is an atomic-unit ratio: decimals must not be applied a second time.
export function fixturePrice(sourceKey, targetKey, sqrtPriceX96) {
  assert.ok(sqrtPriceX96 > 0n, "Doppler snapshot has no initialized price; no 1:1 fallback.");
  if (
    same(sourceKey.currency0, targetKey.currency0) &&
    same(sourceKey.currency1, targetKey.currency1)
  )
    return sqrtPriceX96;
  if (
    same(sourceKey.currency0, targetKey.currency1) &&
    same(sourceKey.currency1, targetKey.currency0)
  )
    return (1n << 192n) / sqrtPriceX96;
  throw new Error("Doppler and fixture currencies do not match.");
}

export function tickAtPrice(price) {
  assert.ok(price >= getSqrtPriceAtTick(-887272) && price < getSqrtPriceAtTick(887272));
  let lower = -887272,
    upper = 887272;
  while (lower + 1 < upper) {
    const mid = Math.floor((lower + upper) / 2);
    if (getSqrtPriceAtTick(mid) <= price) lower = mid;
    else upper = mid;
  }
  return lower;
}

export function seedLiquidity(price, spacing, budget0, budget1) {
  assert.ok(Number.isInteger(spacing) && spacing > 0);
  assert.ok(budget0 > 0n && budget1 > 0n, "Both fixture token budgets must be funded.");
  const tick = tickAtPrice(price);
  const radius = Math.ceil(600 / spacing) * spacing;
  const tickLower = Math.max(
    Math.ceil(-887272 / spacing) * spacing,
    Math.floor(tick / spacing) * spacing - radius
  );
  const tickUpper = Math.min(
    Math.floor(887272 / spacing) * spacing,
    Math.ceil(tick / spacing) * spacing + radius
  );
  const liquidity = maximumLiquidityForAmounts(price, tickLower, tickUpper, budget0, budget1);
  assert.ok(liquidity > 0n && liquidity < 1n << 128n, "Fixture budget cannot seed this range.");
  const amounts = quoteRangeAmounts(price, tickLower, tickUpper, liquidity);
  assert.ok(amounts.amount0 <= budget0 && amounts.amount1 <= budget1);
  return {
    tickLower,
    tickUpper,
    liquidity,
    amount0Max: amounts.amount0,
    amount1Max: amounts.amount1,
  };
}

export async function snapshotMarket(client, launch, snapshot, poolKey) {
  const blockNumber = BigInt(snapshot.number);
  const block = await client.getBlock({ blockNumber });
  assert.equal(block.hash.toLowerCase(), snapshot.hash.toLowerCase(), "Snapshot boundary changed.");
  const [sqrtPriceX96, tick] = await client.readContract({
    address: launch.contracts.stateView.address,
    abi: v4StateViewReadAbi,
    functionName: "getSlot0",
    args: [launch.market.poolId],
    blockNumber,
  });
  const decimals = await Promise.all(
    [poolKey.currency0, poolKey.currency1].map((address) =>
      client.readContract({ address, abi: erc20Abi, functionName: "decimals", blockNumber })
    )
  );
  return {
    version: fixtureVersion,
    snapshot: { number: snapshot.number, hash: snapshot.hash },
    sourcePoolId: launch.market.poolId,
    sourcePoolKey: launch.market.poolKey,
    sourceSqrtPriceX96: String(sqrtPriceX96),
    sourceTick: tick,
    sqrtPriceX96: String(fixturePrice(launch.market.poolKey, poolKey, sqrtPriceX96)),
    decimals,
  };
}

export async function verifyFixture(
  client,
  launch,
  profile,
  historicalClient = client,
  archivedReceipt
) {
  if (profile.marketFixture?.version !== fixtureVersion)
    throw new Error(
      "Legacy fixture has no Doppler price provenance. Preserve this profile; use a new profile or a reviewed fixture migration. No reset or reseed was performed."
    );
  const expected = await snapshotMarket(
    historicalClient,
    launch,
    profile.snapshot,
    profile.pool.poolKey
  );
  for (const key of ["sourcePoolId", "sourceSqrtPriceX96", "sourceTick", "sqrtPriceX96"])
    assert.equal(profile.marketFixture[key], expected[key], `Fixture provenance mismatch: ${key}`);
  assert.deepEqual(profile.marketFixture.decimals, expected.decimals);
  const receipt =
    archivedReceipt ??
    (await client.getTransactionReceipt({ hash: profile.pool.creationTransactionHash }));
  assert.equal(receipt.transactionHash, profile.pool.creationTransactionHash);
  assert.equal(receipt.status, "success", "Pool creation receipt failed.");
  assert.equal(String(receipt.blockNumber), profile.pool.registrationBlock);
  const events = parseEventLogs({
    abi: parseAbi([
      "event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)",
    ]),
    logs: receipt.logs,
  });
  const event = events.find(
    (row) =>
      row.address.toLowerCase() === launch.contracts.poolManager.address.toLowerCase() &&
      row.args.id === profile.pool.poolId
  );
  assert.ok(event, "Pool creation receipt has no matching Initialize event.");
  const initialized = event.args.sqrtPriceX96;
  assert.equal(
    initialized,
    BigInt(expected.sqrtPriceX96),
    "Fixture creation price differs from Doppler snapshot."
  );
  return {
    version: fixtureVersion,
    sourcePoolId: expected.sourcePoolId,
    snapshot: expected.snapshot,
    initializedSqrtPriceX96: String(initialized),
  };
}
