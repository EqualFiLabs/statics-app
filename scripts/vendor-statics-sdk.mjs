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
const configuredSdkExtensionRoot = process.env.STATICS_SDK_EXTENSION_REPOSITORY?.trim();
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
const sdkExtensionRoot = configuredSdkExtensionRoot
  ? resolve(repositoryRoot, configuredSdkExtensionRoot)
  : null;
const destination = resolve(repositoryRoot, "vendor/statics-sdk");

const protocolCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: protocolRoot,
  encoding: "utf8",
}).trim();
const sdkTreeState = [sdkRoot, sdkExtensionRoot]
  .filter(Boolean)
  .some((root) =>
    execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim()
  )
  ? "dirty"
  : "clean";

execFileSync("npm", ["run", "build"], { cwd: sdkRoot, stdio: "inherit" });
if (sdkExtensionRoot) {
  execFileSync("npm", ["run", "build"], { cwd: sdkExtensionRoot, stdio: "inherit" });
}

const files = [
  "dist/index.js",
  "dist/index.d.ts",
  ...(sdkExtensionRoot ? ["dist/genesis-credit.js", "dist/genesis-credit.d.ts"] : []),
  "dist/generated/robinhoodChain.js",
  "dist/generated/robinhoodChain.d.ts",
];
rmSync(destination, { force: true, recursive: true });

const checksums = {};
for (const file of files) {
  const sourceRoot = file.startsWith("dist/genesis-credit.") ? sdkExtensionRoot : sdkRoot;
  if (!sourceRoot) throw new Error(`No SDK source was selected for ${file}.`);
  const source = resolve(sourceRoot, file);
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
const extensionSourceChecksums = sdkExtensionRoot
  ? Object.fromEntries(
      ["src/genesis-credit.ts", "package.json"].map((file) => [
        file,
        createHash("sha256")
          .update(readFileSync(resolve(sdkExtensionRoot, file)))
          .digest("hex"),
      ])
    )
  : undefined;

const sourcePackage = JSON.parse(readFileSync(resolve(sdkRoot, "package.json"), "utf8"));
const extensionPackage = sdkExtensionRoot
  ? JSON.parse(readFileSync(resolve(sdkExtensionRoot, "package.json"), "utf8"))
  : null;
const vendoredPackage = {
  name: sourcePackage.name,
  version: sourcePackage.version,
  private: true,
  type: "module",
  main: "./dist/index.js",
  types: "./dist/index.d.ts",
  exports: { ...sourcePackage.exports, ...(extensionPackage?.exports ?? {}) },
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
      extensionSource: sdkExtensionRoot
        ? {
            repository: sdkSourceUrl.toString().replace(/\/$/u, ""),
            path: ".",
            commit: execFileSync("git", ["rev-parse", "HEAD"], {
              cwd: sdkExtensionRoot,
              encoding: "utf8",
            }).trim(),
          }
        : undefined,
      extensionSourceChecksums,
      sourceChecksums,
      checksums,
    },
    null,
    2
  )}\n`
);

console.log(`Vendored @statics-protocol/sdk from ${protocolCommit}.`);
