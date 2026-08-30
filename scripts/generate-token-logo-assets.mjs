import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tokenListPath = join(root, "lib/generated/token-list.json");
const catalogPath = join(root, "lib/generated/token-logo-assets.json");
const outputDirectory = join(root, "public/assets/token-logos/v1");
const verifyOnly = process.argv.includes("--verify");
const maximumBytes = 1024 * 1024;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sourceUrl(uri) {
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice("ipfs://".length).replace(/^ipfs\//, "")}`;
  }
  return uri;
}

async function download(uri, attempt = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(sourceUrl(uri), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Statics-Asset-Vendor/1.0" },
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await new Promise((done) => setTimeout(done, 300 * 2 ** attempt));
      return download(uri, attempt + 1);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (new URL(response.url).protocol !== "https:") throw new Error("non-HTTPS redirect");
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > maximumBytes) throw new Error("image exceeds size limit");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > maximumBytes) throw new Error("invalid image size");
    return sharp(bytes, { failOn: "warning", limitInputPixels: 4096 * 4096 })
      .resize(128, 128, { fit: "contain", withoutEnlargement: true })
      .webp({ quality: 88, effort: 4 })
      .toBuffer();
  } finally {
    clearTimeout(timeout);
  }
}

async function digestFiles(names) {
  const digest = createHash("sha256");
  for (const name of [...names].sort()) {
    digest.update(name);
    digest.update("\0");
    digest.update(await readFile(join(outputDirectory, name)));
    digest.update("\0");
  }
  return `sha256:${digest.digest("hex")}`;
}

async function verify() {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  if (catalog.schemaVersion !== 1 || catalog.assetBasePath !== "/assets/token-logos/v1") {
    throw new Error("Invalid generated token-logo catalog.");
  }
  const names = await readdir(outputDirectory);
  const mappedNames = Object.values(catalog.logos).map((path) => path.split("/").at(-1));
  if (names.length !== mappedNames.length || new Set(mappedNames).size !== mappedNames.length) {
    throw new Error("Token-logo catalog does not match its asset directory.");
  }
  const digest = await digestFiles(names);
  if (digest !== catalog.contentDigest) throw new Error("Token-logo asset digest mismatch.");
  console.log(
    `Verified ${names.length} local token logos; ${catalog.unavailable.length} sources use symbol fallbacks (${digest}).`
  );
}

async function generate() {
  const tokenList = JSON.parse(await readFile(tokenListPath, "utf8"));
  const uris = [
    ...new Set(
      tokenList.tokens
        .map((token) => token.logoURI)
        .filter((uri) => typeof uri === "string" && /^(https:|ipfs:)/.test(uri))
    ),
  ].sort();
  if (relative(join(root, "public/assets/token-logos"), outputDirectory).startsWith("..")) {
    throw new Error("Refusing to write token logos outside their owned directory.");
  }
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const logos = {};
  const unavailable = [];
  let next = 0;
  async function worker() {
    while (next < uris.length) {
      const index = next;
      next += 1;
      const uri = uris[index];
      const name = `${sha256(uri)}.webp`;
      try {
        const bytes = await download(uri);
        await writeFile(join(outputDirectory, name), bytes);
        logos[uri] = `/assets/token-logos/v1/${name}`;
      } catch (error) {
        unavailable.push({
          uri,
          reason: error instanceof Error ? error.message : "download failed",
        });
      }
      process.stdout.write(`\rProcessed token logos ${index + 1}/${uris.length}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  process.stdout.write("\n");

  const names = await readdir(outputDirectory);
  const catalog = {
    schemaVersion: 1,
    assetBasePath: "/assets/token-logos/v1",
    sourceDigest: `sha256:${sha256(await readFile(tokenListPath))}`,
    contentDigest: await digestFiles(names),
    logos: Object.fromEntries(
      Object.entries(logos).sort(([left], [right]) => left.localeCompare(right))
    ),
    unavailable: unavailable.sort((left, right) => left.uri.localeCompare(right.uri)),
  };
  await mkdir(dirname(catalogPath), { recursive: true });
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await verify();
}

if (verifyOnly) await verify();
else await generate();
