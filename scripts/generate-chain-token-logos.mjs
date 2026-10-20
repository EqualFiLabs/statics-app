import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

/**
 * Logos for tokens the Uniswap list does not cover, keyed by chain and address. Inputs are
 * reviewed in scripts/chain-token-logos.json and always matched by address, never by symbol.
 * Sources are vendored as local WebP files so browsers never load third-party images.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = join(root, "scripts/chain-token-logos.json");
const tokenListPath = join(root, "lib/generated/token-list.json");
const listLogosPath = join(root, "lib/generated/token-logo-assets.json");
const catalogPath = join(root, "lib/generated/chain-token-logos.json");
const assetBasePath = "/assets/token-logos/robinhood";
const outputDirectory = join(root, "public", assetBasePath);
const verifyOnly = process.argv.includes("--verify");
const maximumBytes = 1024 * 1024;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const isAddress = (value) => /^0x[0-9a-fA-F]{40}$/.test(value);

function toWebp(bytes) {
  return sharp(bytes, { failOn: "warning", limitInputPixels: 4096 * 4096 })
    .resize(128, 128, { fit: "contain", withoutEnlargement: true })
    .webp({ quality: 88, effort: 4 })
    .toBuffer();
}

async function download(url) {
  const response = await fetch(url, {
    redirect: "error",
    headers: { "user-agent": "Statics-Asset-Vendor/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  if (!response.headers.get("content-type")?.startsWith("image/"))
    throw new Error(`Not an image: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maximumBytes) throw new Error(`Invalid size: ${url}`);
  return bytes;
}

async function digestFiles(names) {
  const digest = createHash("sha256");
  for (const name of [...names].sort()) {
    digest
      .update(name)
      .update("\0")
      .update(await readFile(join(outputDirectory, name)))
      .update("\0");
  }
  return `sha256:${digest.digest("hex")}`;
}

async function verify() {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  if (catalog.schemaVersion !== 1 || catalog.assetBasePath !== assetBasePath)
    throw new Error("Invalid chain token-logo catalog.");
  const inputBytes = await readFile(inputPath);
  if (catalog.sourceDigest !== `sha256:${sha256(inputBytes)}`)
    throw new Error("Chain token-logo source digest mismatch.");
  const names = await readdir(outputDirectory);
  const mapped = new Set(
    Object.values(catalog.logos)
      .filter((path) => path.startsWith(assetBasePath))
      .map((path) => path.split("/").at(-1))
  );
  if (names.length !== mapped.size || names.some((name) => !mapped.has(name)))
    throw new Error("Chain token-logo catalog does not match its asset directory.");
  if ((await digestFiles(names)) !== catalog.contentDigest)
    throw new Error("Chain token-logo asset digest mismatch.");
  console.log(`Verified ${Object.keys(catalog.logos).length} chain token logos.`);
}

async function generate() {
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const { chainId } = input;
  const key = (address) => {
    if (!isAddress(address)) throw new Error(`Invalid address ${address}`);
    return `${chainId}:${address.toLowerCase()}`;
  };
  await mkdir(outputDirectory, { recursive: true });
  const logos = {};
  const store = async (address, bytes) => {
    const webp = await toWebp(bytes);
    const name = `${sha256(webp)}.webp`;
    await writeFile(join(outputDirectory, name), webp);
    logos[key(address)] = `${assetBasePath}/${name}`;
  };
  // Robinhood serves token logos by lower-case contract address.
  for (const [symbol, address] of Object.entries(input.robinhoodCdn)) {
    const lower = address.toLowerCase();
    await store(address, await download(`https://cdn.robinhood.com/ncw_assets/logos/${lower}.png`));
    process.stdout.write(`Vendored ${symbol}\n`);
  }
  // Reviewed project logos hosted elsewhere, vendored like the rest.
  for (const [symbol, entry] of Object.entries(input.remoteImages ?? {})) {
    if (!entry.url.startsWith("https://")) throw new Error(`${symbol} logo must use HTTPS.`);
    await store(entry.address, await download(entry.url));
    process.stdout.write(`Vendored ${symbol}\n`);
  }
  for (const [symbol, entry] of Object.entries(input.localFiles)) {
    await store(entry.address, await readFile(join(root, entry.file)));
    process.stdout.write(`Converted ${symbol}\n`);
  }
  // The same asset on another chain: reuse its already-vendored Uniswap-list logo.
  const tokenList = JSON.parse(await readFile(tokenListPath, "utf8"));
  const listLogos = JSON.parse(await readFile(listLogosPath, "utf8")).logos;
  for (const [symbol, entry] of Object.entries(input.tokenListAliases)) {
    const source = tokenList.tokens.find(
      (token) =>
        token.chainId === entry.source.chainId &&
        token.address.toLowerCase() === entry.source.address.toLowerCase()
    );
    const path = source?.logoURI && listLogos[source.logoURI];
    if (!path || source.symbol !== symbol) throw new Error(`No vendored list logo for ${symbol}.`);
    logos[key(entry.address)] = path;
  }
  const names = await readdir(outputDirectory);
  const catalog = {
    schemaVersion: 1,
    assetBasePath,
    sourceDigest: `sha256:${sha256(await readFile(inputPath))}`,
    contentDigest: await digestFiles(names),
    logos: Object.fromEntries(Object.entries(logos).sort(([a], [b]) => a.localeCompare(b))),
  };
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await verify();
}

if (verifyOnly) await verify();
else await generate();
