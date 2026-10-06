import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configuredProtocolRoot = process.env.STATICS_PROTOCOL_REPOSITORY?.trim();
if (!configuredProtocolRoot) {
  throw new Error("STATICS_PROTOCOL_REPOSITORY must name a clean public Statics checkout.");
}
const protocolRoot = resolve(repositoryRoot, configuredProtocolRoot);
const configuredSdkRoot = process.env.STATICS_SDK_REPOSITORY?.trim();
const configuredSdkExtensionRoot = process.env.STATICS_SDK_EXTENSION_REPOSITORY?.trim();
const configuredPhaseOneSdkRoot = process.env.STATICS_PHASE_ONE_SDK_REPOSITORY?.trim();
const configuredLegacyArtifactsRoot = process.env.STATICS_LEGACY_SDK_ARTIFACTS?.trim();
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
const phaseOneSdkRoot = configuredPhaseOneSdkRoot
  ? resolve(repositoryRoot, configuredPhaseOneSdkRoot)
  : null;
const legacyArtifactsRoot = configuredLegacyArtifactsRoot
  ? resolve(repositoryRoot, configuredLegacyArtifactsRoot)
  : null;
const destination = resolve(repositoryRoot, "vendor/statics-sdk");
if (
  existsSync(resolve(destination, "provenance.json")) &&
  JSON.parse(readFileSync(resolve(destination, "provenance.json"), "utf8")).batchRewardsSource &&
  !process.env.STATICS_BATCH_REWARDS_SDK_REPOSITORY?.trim()
) {
  throw new Error(
    "Set STATICS_BATCH_REWARDS_SDK_REPOSITORY to retain the installed batch SDK during sync."
  );
}

const protocolCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: protocolRoot,
  encoding: "utf8",
}).trim();
function sdkTreeDirty(root) {
  if (!root) return false;
  const gitRoot = execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
  const relativeRoot = relative(gitRoot, root) || ".";
  return Boolean(
    execFileSync(
      "git",
      ["-C", gitRoot, "status", "--porcelain", "--untracked-files=all", "--", relativeRoot],
      { encoding: "utf8" }
    ).trim()
  );
}
const sdkTreeState =
  sdkTreeDirty(legacyArtifactsRoot) ||
  (!legacyArtifactsRoot && sdkTreeDirty(sdkRoot)) ||
  (!legacyArtifactsRoot && sdkTreeDirty(sdkExtensionRoot)) ||
  sdkTreeDirty(phaseOneSdkRoot)
    ? "dirty"
    : "clean";

if (!legacyArtifactsRoot) {
  execFileSync("npm", ["run", "build"], { cwd: sdkRoot, stdio: "inherit" });
}
if (!legacyArtifactsRoot && sdkExtensionRoot) {
  execFileSync("npm", ["run", "build"], { cwd: sdkExtensionRoot, stdio: "inherit" });
}
if (phaseOneSdkRoot) {
  execFileSync("npm", ["run", "build"], { cwd: phaseOneSdkRoot, stdio: "inherit" });
}

const files = [
  "dist/index.js",
  "dist/index.d.ts",
  ...(legacyArtifactsRoot || sdkExtensionRoot
    ? ["dist/genesis-credit.js", "dist/genesis-credit.d.ts"]
    : []),
  "dist/generated/robinhoodChain.js",
  "dist/generated/robinhoodChain.d.ts",
];
const phaseOneFiles = [
  "index.js",
  "index.d.ts",
  "gauge-incentives.js",
  "gauge-incentives.d.ts",
  "market-tape.js",
  "market-tape.d.ts",
  "range-gauges.js",
  "range-gauges.d.ts",
  "generated/robinhoodChain.js",
  "generated/robinhoodChain.d.ts",
];
if (existsSync(destination)) {
  execFileSync("gio", ["trash", destination]);
}

const checksums = {};
for (const file of files) {
  const sourceRoot = legacyArtifactsRoot
    ? legacyArtifactsRoot
    : file.startsWith("dist/genesis-credit.")
      ? sdkExtensionRoot
      : sdkRoot;
  if (!sourceRoot) throw new Error(`No SDK source was selected for ${file}.`);
  const source = resolve(sourceRoot, file);
  const content = readFileSync(source);
  const target = resolve(destination, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  checksums[file] = createHash("sha256").update(content).digest("hex");
}
const phaseOneChecksums = {};
for (const file of phaseOneSdkRoot ? phaseOneFiles : []) {
  const source = resolve(phaseOneSdkRoot, "dist", file);
  const content = readFileSync(source);
  const target = resolve(destination, "dist/phase-one", file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  phaseOneChecksums[`dist/phase-one/${file}`] = createHash("sha256").update(content).digest("hex");
}
const legacyProvenance = legacyArtifactsRoot
  ? JSON.parse(readFileSync(resolve(legacyArtifactsRoot, "provenance.json"), "utf8"))
  : null;
const sourceChecksums =
  legacyProvenance?.sourceChecksums ??
  Object.fromEntries(
    ["src/index.ts", "package.json"].map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(resolve(sdkRoot, file)))
        .digest("hex"),
    ])
  );
const extensionSourceChecksums =
  legacyProvenance?.extensionSourceChecksums ??
  (sdkExtensionRoot
    ? Object.fromEntries(
        ["src/genesis-credit.ts", "package.json"].map((file) => [
          file,
          createHash("sha256")
            .update(readFileSync(resolve(sdkExtensionRoot, file)))
            .digest("hex"),
        ])
      )
    : undefined);
const phaseOneSourceChecksums = phaseOneSdkRoot
  ? Object.fromEntries(
      [
        "src/index.ts",
        "src/gauge-incentives.ts",
        "src/market-tape.ts",
        "src/range-gauges.ts",
        "package.json",
      ].map((file) => [
        file,
        createHash("sha256")
          .update(readFileSync(resolve(phaseOneSdkRoot, file)))
          .digest("hex"),
      ])
    )
  : undefined;

const sourcePackage = JSON.parse(
  readFileSync(resolve(legacyArtifactsRoot ?? sdkRoot, "package.json"), "utf8")
);
const extensionPackage =
  !legacyArtifactsRoot && sdkExtensionRoot
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
if (phaseOneSdkRoot) {
  vendoredPackage.exports["./phase-one"] = {
    types: "./dist/phase-one/index.d.ts",
    import: "./dist/phase-one/index.js",
  };
}

writeFileSync(
  resolve(destination, "package.json"),
  `${JSON.stringify(vendoredPackage, null, 2)}\n`
);
writeFileSync(
  resolve(destination, "provenance.json"),
  `${JSON.stringify(
    {
      protocolCommit,
      source: legacyProvenance?.source ?? {
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
      extensionSource:
        legacyProvenance?.extensionSource ??
        (sdkExtensionRoot
          ? {
              repository: sdkSourceUrl.toString().replace(/\/$/u, ""),
              path: ".",
              commit: execFileSync("git", ["rev-parse", "HEAD"], {
                cwd: sdkExtensionRoot,
                encoding: "utf8",
              }).trim(),
            }
          : undefined),
      extensionSourceChecksums,
      phaseOneSource: phaseOneSdkRoot
        ? {
            repository: sdkSourceUrl.toString().replace(/\/$/u, ""),
            path: ".",
            commit: execFileSync("git", ["rev-parse", "HEAD"], {
              cwd: phaseOneSdkRoot,
              encoding: "utf8",
            }).trim(),
          }
        : undefined,
      phaseOneSourceChecksums,
      sourceChecksums,
      checksums: { ...checksums, ...phaseOneChecksums },
    },
    null,
    2
  )}\n`
);

console.log(`Vendored @statics-protocol/sdk from ${protocolCommit}.`);

if (process.env.STATICS_BATCH_REWARDS_SDK_REPOSITORY?.trim()) {
  await import("./vendor-batch-rewards-sdk.mjs");
}
