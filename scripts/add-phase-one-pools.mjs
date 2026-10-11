#!/usr/bin/env node
/**
 * Lists Phase 1 pools missing from a manifest, or adds the ones named.
 *
 * Usage:
 *   node scripts/add-phase-one-pools.mjs --manifest <file> --indexer <url>            # list
 *   node scripts/add-phase-one-pools.mjs --manifest <file> --indexer <url> <poolId>... # add
 */
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";

import { addPools, listIndexedPools, unlistedPools } from "./lib/phase-one-pools.mjs";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`Missing required --${name}`);
  return process.argv[index + 1];
}

async function main() {
  const manifestPath = resolve(process.cwd(), arg("manifest"));
  const indexerUrl = arg("indexer");
  const poolIds = [];
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--manifest" || args[index] === "--indexer") {
      index++;
      continue;
    }
    if (!/^0x[0-9a-f]{64}$/iu.test(args[index]))
      throw new Error("Unknown argument or invalid PoolId.");
    poolIds.push(args[index]);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const indexed = await listIndexedPools({ indexerUrl, deploymentId: manifest.deploymentId });
  if (!poolIds.length) {
    const unlisted = unlistedPools(manifest, indexed);
    if (!unlisted.length) return console.log("Every indexed pool is in the manifest.");
    for (const pool of unlisted)
      console.log(
        `${pool.poolId}  ${pool.token0.symbol}/${pool.token1.symbol}  ` +
          `fee ${pool.poolKey.fee}  block ${pool.createdAtBlock}  ` +
          `${pool.token0.address} ${pool.token1.address}`
      );
    return console.log("\nRerun with the PoolIds to add.");
  }
  const updated = addPools(manifest, poolIds, indexed);
  const temporary = `${manifestPath}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(updated, null, 2)}\n`, { flag: "wx" });
  renameSync(temporary, manifestPath);
  for (const pool of updated.supportedPools.slice(-poolIds.length))
    console.log(`Added ${pool.token0.symbol}/${pool.token1.symbol} ${pool.poolId}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
