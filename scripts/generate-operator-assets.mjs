import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  isHex,
  keccak256,
  parseAbi,
  zeroAddress,
} from "viem";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(root, "scripts/operator-assets.json");
const generatedCatalogPath = join(root, "lib/generated/operator-assets.json");
const verifyOnly = process.argv.includes("--verify");
const renderAbi = parseAbi([
  "function renderTokenURI(address collection, uint256 tokenId, address activationRegistry) view returns (string)",
]);

function decodeDataUri(uri, expectedPrefix) {
  if (!uri.startsWith(expectedPrefix)) {
    throw new Error(`Expected ${expectedPrefix} data URI.`);
  }
  return Buffer.from(uri.slice(expectedPrefix.length), "base64").toString("utf8");
}

function immutableTraits(attributes) {
  if (!Array.isArray(attributes)) throw new Error("Operator attributes are missing.");
  return attributes
    .filter((attribute) => attribute?.trait_type !== "Activation Tier")
    .map((attribute) => {
      if (typeof attribute?.trait_type !== "string") throw new Error("Invalid trait label.");
      if (typeof attribute?.value !== "string" && typeof attribute?.value !== "number") {
        throw new Error("Invalid trait value.");
      }
      return { label: attribute.trait_type, value: String(attribute.value), max: null };
    });
}

function validateTierZero(attributes) {
  const tier = attributes.find((attribute) => attribute?.trait_type === "Activation Tier");
  if (tier?.value !== 0 || tier?.max_value !== 4) {
    throw new Error("Renderer did not return tier-zero metadata.");
  }
}

function signalVariant(attributes) {
  const signal = attributes.find((attribute) => attribute?.trait_type === "Signal")?.value;
  const variants = ["Neon Green", "Cyan", "Amber", "Red", "Purple", "White Only"];
  const index = variants.indexOf(signal);
  if (index === -1) throw new Error("Operator Signal trait is invalid.");
  return String(index);
}

async function rpc(rpcUrl, payload, attempt = 0) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if ((response.status === 429 || response.status >= 500) && attempt < 6) {
    await new Promise((done) => setTimeout(done, 250 * 2 ** attempt));
    return rpc(rpcUrl, payload, attempt + 1);
  }
  if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}.`);
  return response.json();
}

async function verifyRuntimeCode(rpcUrl, entry, requestId) {
  const response = await rpc(rpcUrl, {
    jsonrpc: "2.0",
    id: requestId,
    method: "eth_getCode",
    params: [entry.address, "latest"],
  });
  if (response.error) throw new Error(response.error.message ?? "eth_getCode failed.");
  if (
    !isHex(response.result) ||
    keccak256(response.result).toLowerCase() !== entry.runtimeCodeHash
  ) {
    throw new Error(`Runtime code mismatch for ${entry.address}.`);
  }
}

async function renderBatch(rpcUrl, config, ids) {
  const calls = ids.map((id) => ({
    jsonrpc: "2.0",
    id,
    method: "eth_call",
    params: [
      {
        to: config.renderer.address,
        data: encodeFunctionData({
          abi: renderAbi,
          functionName: "renderTokenURI",
          args: [config.collection.address, BigInt(id), zeroAddress],
        }),
      },
      "latest",
    ],
  }));
  const raw = await rpc(rpcUrl, calls);
  if (!Array.isArray(raw)) throw new Error("RPC batch response is not an array.");
  const byId = new Map(raw.map((entry) => [entry.id, entry]));
  return ids.map((id) => {
    const entry = byId.get(id);
    if (!entry || entry.error) {
      throw new Error(entry?.error?.message ?? `Missing renderer response for Operator #${id}.`);
    }
    return decodeFunctionResult({
      abi: renderAbi,
      functionName: "renderTokenURI",
      data: entry.result,
    });
  });
}

function versionFor(config) {
  return config.renderer.runtimeCodeHash.slice(2, 18);
}

async function digestDirectory(assetDirectory, maximumSupply) {
  const digest = createHash("sha256");
  for (let id = 1; id <= maximumSupply; id += 1) {
    const name = `${id}.svg`;
    const content = await readFile(join(assetDirectory, name));
    digest.update(name);
    digest.update("\0");
    digest.update(content);
    digest.update("\0");
  }
  return `sha256:${digest.digest("hex")}`;
}

async function verifyGenerated(config) {
  const catalog = JSON.parse(await readFile(generatedCatalogPath, "utf8"));
  const expectedVersion = versionFor(config);
  if (
    catalog.schemaVersion !== 1 ||
    catalog.version !== expectedVersion ||
    getAddress(catalog.collection) !== getAddress(config.collection.address) ||
    catalog.chainId !== config.chainId ||
    catalog.maximumSupply !== config.collection.maximumSupply ||
    catalog.signalVariants.length !== config.collection.maximumSupply
  ) {
    throw new Error("Generated Operator catalog does not match its source configuration.");
  }
  const assetDirectory = join(root, "public", catalog.assetBasePath.replace(/^\//, ""));
  const names = await readdir(assetDirectory);
  if (names.length !== config.collection.maximumSupply) {
    throw new Error(`Expected ${config.collection.maximumSupply} Operator asset files.`);
  }
  const actualDigest = await digestDirectory(assetDirectory, config.collection.maximumSupply);
  if (actualDigest !== catalog.contentDigest) throw new Error("Operator asset digest mismatch.");
  console.log(
    `Verified ${config.collection.maximumSupply} Operator SVGs with embedded traits (${actualDigest}).`
  );
}

async function generate(config) {
  const rpcUrl = process.env.ROBINHOOD_MAINNET ?? process.env.STATICS_OPERATOR_ASSET_RPC_URL;
  if (!rpcUrl) {
    throw new Error(
      "Set ROBINHOOD_MAINNET or STATICS_OPERATOR_ASSET_RPC_URL to an authenticated RPC."
    );
  }
  await Promise.all([
    verifyRuntimeCode(rpcUrl, config.collection, "collection-code"),
    verifyRuntimeCode(rpcUrl, config.renderer, "renderer-code"),
  ]);

  const version = versionFor(config);
  const assetBasePath = `/assets/operators/${version}`;
  const outputDirectory = join(root, "public", assetBasePath.slice(1));
  if (relative(join(root, "public/assets/operators"), outputDirectory).startsWith("..")) {
    throw new Error("Refusing to write Operator assets outside their owned directory.");
  }
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const batchSize = 40;
  const signalVariants = Array(config.collection.maximumSupply);
  for (let start = 1; start <= config.collection.maximumSupply; start += batchSize) {
    const ids = Array.from(
      { length: Math.min(batchSize, config.collection.maximumSupply - start + 1) },
      (_, index) => start + index
    );
    const uris = await renderBatch(rpcUrl, config, ids);
    await Promise.all(
      uris.map(async (uri, index) => {
        const id = ids[index];
        const metadata = JSON.parse(decodeDataUri(uri, "data:application/json;base64,"));
        if (metadata.name !== `STATICS Operators #${id}`) {
          throw new Error(`Renderer identity mismatch for Operator #${id}.`);
        }
        validateTierZero(metadata.attributes);
        signalVariants[id - 1] = signalVariant(metadata.attributes);
        const svg = decodeDataUri(metadata.image, "data:image/svg+xml;base64,");
        if (!svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')) {
          throw new Error(`Invalid SVG for Operator #${id}.`);
        }
        if (svg.includes('id="activation-tier"')) {
          throw new Error(`Tier overlay unexpectedly present for Operator #${id}.`);
        }
        const traits = Buffer.from(
          JSON.stringify(immutableTraits(metadata.attributes)),
          "utf8"
        ).toString("base64");
        const localSvg = svg.replace(
          "</svg>",
          `<metadata id="statics-operator-traits">${traits}</metadata></svg>`
        );
        await writeFile(join(outputDirectory, `${id}.svg`), `${localSvg}\n`);
      })
    );
    process.stdout.write(
      `\rGenerated Operators ${ids[0]}-${ids.at(-1)} of ${config.collection.maximumSupply}`
    );
  }
  process.stdout.write("\n");

  const contentDigest = await digestDirectory(outputDirectory, config.collection.maximumSupply);
  const catalog = {
    schemaVersion: 1,
    chainId: config.chainId,
    protocolCommit: config.protocolCommit,
    collection: getAddress(config.collection.address),
    collectionRuntimeCodeHash: config.collection.runtimeCodeHash,
    renderer: getAddress(config.renderer.address),
    rendererRuntimeCodeHash: config.renderer.runtimeCodeHash,
    maximumSupply: config.collection.maximumSupply,
    version,
    assetBasePath,
    contentDigest,
    signalVariants: signalVariants.join(""),
  };
  await mkdir(dirname(generatedCatalogPath), { recursive: true });
  await writeFile(generatedCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await verifyGenerated(config);
}

const config = JSON.parse(await readFile(configPath, "utf8"));
config.collection.address = getAddress(config.collection.address);
config.renderer.address = getAddress(config.renderer.address);
if (verifyOnly) await verifyGenerated(config);
else await generate(config);
