import { encodeAbiParameters, getAddress, keccak256 } from "viem";

/**
 * Adds admin-approved Phase 1 pools to a manifest, using the indexer's PoolKey, registration block
 * and token metadata. Tokens the manifest already lists keep their curated metadata.
 */

const lower = (value) => String(value).toLowerCase();

/** Reads every indexed Phase 1 pool. */
export async function listIndexedPools({ indexerUrl, deploymentId, fetch: fetchPage = fetch }) {
  const pools = [];
  let cursor;
  const seen = new Set();
  do {
    const query = new URLSearchParams({
      deploymentId,
      eligible: "all",
      limit: "100",
      sort: "created",
      direction: "asc",
      ...(cursor ? { cursor } : {}),
    });
    const response = await fetchPage(
      `${indexerUrl.replace(/\/$/u, "")}/phase-one/allocation-pools?${query}`,
      { signal: AbortSignal.timeout(30_000) }
    );
    if (!response.ok) throw new Error(`The indexer answered ${response.status}.`);
    const page = await response.json();
    if (
      page.deploymentId !== deploymentId ||
      !Array.isArray(page.items) ||
      !(
        page.nextCursor === null ||
        (typeof page.nextCursor === "string" && page.nextCursor.length > 0)
      )
    )
      throw new Error("The indexer returned an invalid pool directory.");
    if (page.nextCursor && seen.has(page.nextCursor))
      throw new Error("The indexer repeated a directory cursor.");
    if (page.nextCursor) seen.add(page.nextCursor);
    pools.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return pools;
}

/** Indexed pools the manifest does not list yet, oldest first. */
export function unlistedPools(manifest, indexed) {
  const listed = new Set(manifest.supportedPools.map((pool) => lower(pool.poolId)));
  return indexed.filter((pool) => !listed.has(lower(pool.poolId)));
}

const address = (value) => {
  try {
    return getAddress(value);
  } catch {
    throw new Error("Pool metadata has an invalid address.");
  }
};
const requireToken = (meta, currency) => {
  if (
    !meta ||
    address(meta.address).toLowerCase() !== currency.toLowerCase() ||
    typeof meta.name !== "string" ||
    !meta.name.trim() ||
    typeof meta.symbol !== "string" ||
    !meta.symbol.trim() ||
    !Number.isInteger(meta.decimals) ||
    meta.decimals < 0 ||
    meta.decimals > 255
  )
    throw new Error(
      "Pool token metadata is incomplete or inconsistent; review it before adding the pool."
    );
  return meta;
};
const validatePool = (pool, manifest) => {
  const key = pool.poolKey;
  if (
    !key ||
    !Number.isInteger(key.fee) ||
    key.fee < 0 ||
    key.fee > 0xffffff ||
    !Number.isInteger(key.tickSpacing) ||
    key.tickSpacing < 1 ||
    key.tickSpacing > 32767
  )
    throw new Error("Invalid indexed PoolKey.");
  const currency0 = address(key.currency0),
    currency1 = address(key.currency1),
    hooks = address(key.hooks);
  if (BigInt(currency0) >= BigInt(currency1)) throw new Error("Pool currencies are not ordered.");
  const expectedHook = manifest.contracts?.publicHook?.address;
  if (!expectedHook || address(expectedHook).toLowerCase() !== hooks.toLowerCase())
    throw new Error("Pool hook does not match the manifest deployment.");
  const computed = keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [currency0, currency1, key.fee, key.tickSpacing, hooks]
    )
  );
  if (lower(computed) !== lower(pool.poolId)) throw new Error("PoolId does not match its PoolKey.");
  if (
    typeof pool.createdAtBlock !== "string" ||
    !/^(0|[1-9]\d*)$/u.test(pool.createdAtBlock) ||
    BigInt(pool.createdAtBlock) < BigInt(manifest.deploymentStartBlock)
  )
    throw new Error("Pool registration block precedes the deployment.");
  requireToken(pool.token0, currency0);
  requireToken(pool.token1, currency1);
};
export function addPools(manifest, poolIds, indexed) {
  const requested = new Set();
  for (const id of poolIds) {
    if (!/^0x[0-9a-f]{64}$/iu.test(id)) throw new Error("Requested PoolId must be a 32-byte hash.");
    if (requested.has(lower(id))) throw new Error("Duplicate requested pool.");
    requested.add(lower(id));
  }
  const listed = new Set(manifest.supportedPools.map((pool) => lower(pool.poolId)));
  const known = new Map(
    manifest.supportedPools
      .flatMap((pool) => [pool.token0, pool.token1])
      .map((t) => [lower(t.address), t])
  );
  const token = (meta) =>
    known.get(lower(meta.address)) ?? {
      address: meta.address,
      name: meta.name,
      symbol: meta.symbol,
      decimals: meta.decimals,
    };
  const added = poolIds.map((id) => {
    if (listed.has(lower(id))) throw new Error(`${id} is already in the manifest.`);
    const pool = indexed.find((candidate) => lower(candidate.poolId) === lower(id));
    if (!pool) throw new Error(`${id} is not an indexed Phase 1 pool.`);
    validatePool(pool, manifest);
    return {
      poolKey: pool.poolKey,
      poolId: lower(pool.poolId),
      registrationBlock: String(pool.createdAtBlock),
      token0: requireToken(token(pool.token0), pool.poolKey.currency0),
      token1: requireToken(token(pool.token1), pool.poolKey.currency1),
      enabled: true,
    };
  });
  return { ...manifest, supportedPools: [...manifest.supportedPools, ...added] };
}
