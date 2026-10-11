import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, stringToHex } from "viem";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const identities = {
  "robinhood-genesis": ["launch", 4663],
  "robinhood-testnet-genesis": ["launch", 46630],
  "robinhood-phase-one": ["phaseOne", 4663],
  "robinhood-testnet-phase-one": ["phaseOne", 46630],
};

function json(path) {
  const text = readFileSync(path, "utf8");
  if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw new Error("Manifest exceeds 2 MiB.");
  return JSON.parse(text);
}

function add(bundle, manifest) {
  const identity = Object.hasOwn(identities, manifest.deploymentId)
    ? identities[manifest.deploymentId]
    : null;
  if (identity && manifest.chainId === identity[1]) {
    bundle[identity[0]][manifest.deploymentId] = manifest;
  } else if (
    !manifest.deploymentId &&
    [4663, 46630].includes(manifest.chainId) &&
    manifest.schemaVersion === 5
  ) {
    bundle.protocol[String(manifest.chainId)] = manifest;
  } else throw new Error("Input must be a public Genesis, Phase 1 or protocol manifest.");
}

const args = process.argv.slice(2);
let output;
let base;
const additions = [];
for (let i = 0; i < args.length; i += 2) {
  const flag = args[i];
  const value = args[i + 1];
  if (!value || !["--output", "--base", "--manifest"].includes(flag))
    throw new Error(
      "Usage: npm run deployment:runtime -- --output <new-file> [--base <bundle>] [--manifest <public-manifest>]..."
    );
  if (flag === "--output") output = resolve(value);
  else if (flag === "--base") base = resolve(value);
  else additions.push(resolve(value));
}
if (!output) throw new Error("--output is required; an existing output is never overwritten.");
let bundle;
if (base) {
  bundle = json(base);
  if (bundle.schemaVersion !== 1 || !bundle.launch || !bundle.phaseOne || !bundle.protocol)
    throw new Error("Invalid base bundle.");
} else {
  bundle = { schemaVersion: 1, launch: {}, phaseOne: {}, protocol: {} };
  const directory = resolve(root, "deployments");
  for (const name of readdirSync(directory).filter((name) => name.endsWith(".json")))
    add(bundle, json(resolve(directory, name)));
}
for (const path of additions) add(bundle, json(path));
const serialized = JSON.stringify(bundle);
if (Buffer.byteLength(serialized) > 2 * 1024 * 1024) throw new Error("Bundle exceeds 2 MiB.");
writeFileSync(output, `${JSON.stringify(bundle, null, 2)}\n`, { flag: "wx", mode: 0o644 });
console.log(`Created public manifest candidate: ${output}`);
console.log(`Revision: ${keccak256(stringToHex(serialized))}`);
console.log(
  "Validate the candidate through /api/deployments on the staged app before publishing it."
);
