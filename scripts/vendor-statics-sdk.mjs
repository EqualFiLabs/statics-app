import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configuredProtocolRoot = process.env.STATICS_PROTOCOL_REPOSITORY?.trim();
if (!configuredProtocolRoot) {
  throw new Error("STATICS_PROTOCOL_REPOSITORY must name a clean public Statics checkout.");
}
const protocolRoot = resolve(repositoryRoot, configuredProtocolRoot);
const configuredSdkRoot = process.env.STATICS_SDK_REPOSITORY?.trim();
const sourceRepository =
  process.env.STATICS_PROTOCOL_SOURCE_URL?.trim() || "https://github.com/EqualFiLabs/statics";
const sourceUrl = new URL(sourceRepository);
if (sourceUrl.protocol !== "https:" || sourceUrl.username || sourceUrl.password) {
  throw new Error("STATICS_PROTOCOL_SOURCE_URL must be a credential-free HTTPS URL.");
}
const sdkSourceUrl = new URL(
  process.env.STATICS_SDK_SOURCE_URL?.trim() || "https://github.com/EqualFiLabs/statics-sdk"
);
if (sdkSourceUrl.protocol !== "https:" || sdkSourceUrl.username || sdkSourceUrl.password) {
  throw new Error("STATICS_SDK_SOURCE_URL must be a credential-free HTTPS URL.");
}
const sdkRoot = configuredSdkRoot
  ? resolve(repositoryRoot, configuredSdkRoot)
  : resolve(protocolRoot, "sdk");
const destination = resolve(repositoryRoot, "vendor/statics-sdk");

const protocolCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: protocolRoot,
  encoding: "utf8",
}).trim();
const sdkTreeState = execFileSync("git", ["status", "--porcelain"], {
  cwd: sdkRoot,
  encoding: "utf8",
}).trim()
  ? "dirty"
  : "clean";

execFileSync("npm", ["run", "build"], { cwd: sdkRoot, stdio: "inherit" });

const files = [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/generated/robinhoodChain.js",
  "dist/generated/robinhoodChain.d.ts",
];
rmSync(destination, { force: true, recursive: true });

const checksums = {};
for (const file of files) {
  const source = resolve(sdkRoot, file);
  const content = readFileSync(source);
  const target = resolve(destination, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  checksums[file] = createHash("sha256").update(content).digest("hex");
}
const sourceChecksums = Object.fromEntries(
  ["src/index.ts", "package.json"].map((file) => [
    file,
    createHash("sha256")
      .update(readFileSync(resolve(sdkRoot, file)))
      .digest("hex"),
  ])
);

const sourcePackage = JSON.parse(readFileSync(resolve(sdkRoot, "package.json"), "utf8"));
const vendoredPackage = {
  name: sourcePackage.name,
  version: sourcePackage.version,
  private: true,
  type: "module",
  main: "./dist/index.js",
  types: "./dist/index.d.ts",
  exports: sourcePackage.exports,
  peerDependencies: sourcePackage.peerDependencies,
  license: sourcePackage.license,
};

writeFileSync(
  resolve(destination, "package.json"),
  `${JSON.stringify(vendoredPackage, null, 2)}\n`
);
writeFileSync(
  resolve(destination, "provenance.json"),
  `${JSON.stringify(
    {
      protocolCommit,
      source: {
        repository: configuredSdkRoot
          ? sdkSourceUrl.toString().replace(/\/$/u, "")
          : sourceUrl.toString().replace(/\/$/u, ""),
        path: configuredSdkRoot ? "." : "sdk",
        commit: execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: sdkRoot,
          encoding: "utf8",
        }).trim(),
      },
      sdkTreeState,
      sourceChecksums,
      checksums,
    },
    null,
    2
  )}\n`
);

console.log(`Vendored @statics-protocol/sdk from ${protocolCommit}.`);
