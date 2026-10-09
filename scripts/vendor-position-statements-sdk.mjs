import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Regenerate the legacy root from its recorded source, preserving independent
// Genesis-credit/batch/timing overlays. Phase 1 receives the coordinated SDK build.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configured = process.env.STATICS_POSITION_STATEMENT_SDK_REPOSITORY?.trim();
if (!configured)
  throw new Error("Set STATICS_POSITION_STATEMENT_SDK_REPOSITORY to a clean SDK checkout.");
const checkout = resolve(root, configured),
  destination = resolve(root, "vendor/statics-sdk");
const git = (...args) => execFileSync("git", args, { cwd: checkout, encoding: "utf8" }).trim();
if (git("status", "--porcelain")) throw new Error("Statement SDK checkout must be clean.");
const commit = git("rev-parse", "HEAD"),
  provenancePath = resolve(destination, "provenance.json");
const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
const protocolRepository =
  process.env.STATICS_POSITION_STATEMENT_PROTOCOL_REPOSITORY?.trim() ??
  process.env.STATICS_PROTOCOL_REPOSITORY?.trim();
if (!protocolRepository && !provenance.positionStatementProtocolCommit)
  throw new Error("Set STATICS_PROTOCOL_REPOSITORY to record the statement protocol revision.");
if (protocolRepository) {
  provenance.positionStatementProtocolCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: resolve(root, protocolRepository),
    encoding: "utf8",
  }).trim();
}
const checksum = (bytes) => createHash("sha256").update(bytes).digest("hex");
execFileSync("npm", ["run", "build"], { cwd: checkout, stdio: "inherit" });
function copyTree(source, target) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.isDirectory()) copyTree(resolve(source, entry.name), resolve(target, entry.name));
    else if (/\.(js|d\.ts)$/.test(entry.name))
      copyFileSync(resolve(source, entry.name), resolve(target, entry.name));
  }
}
copyTree(resolve(checkout, "dist"), resolve(destination, "dist/phase-one"));
const scratch = resolve(root, ".local/statement-vendor");
copyTree(resolve(destination, "dist"), scratch);
writeFileSync(resolve(scratch, "package.json"), JSON.stringify({ type: "module" }));
const legacyCommit =
  provenance.positionStatementLegacyArtifactsCommit ??
  execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const legacy = (extension) =>
  execFileSync("git", ["show", `${legacyCommit}:vendor/statics-sdk/dist/index.${extension}`], {
    cwd: root,
    encoding: "utf8",
  });
let javascript = legacy("js"),
  declarations = legacy("d.ts");
const previousEvent =
  "event RewardClaimed(uint256 indexed positionId,address indexed receiver,address indexed asset,uint256 amount)";
if (!javascript.includes(previousEvent)) throw new Error("Unexpected legacy RewardClaimed ABI.");
javascript = javascript.replace(
  previousEvent,
  "event RewardClaimed(uint256 indexed positionId,address indexed receiver,address indexed asset,uint256 debited,uint256 received)"
);
const rangeSource = readFileSync(resolve(checkout, "src/range-gauges.ts"), "utf8"),
  allocationSource = readFileSync(resolve(checkout, "src/gauge-incentives.ts"), "utf8");
const fragments = [
  ...rangeSource.matchAll(
    /^\s*"(struct (?:LiquidityStatementMovement|RebalanceSettlement).*|event ManagedLiquidity(?:Provided|Attached|Changed|Rebalanced|Exited|FeesCollected).*?)",?$/gm
  ),
  ...allocationSource.matchAll(/^\s*"(event PositionGaugeAllocationsSet.*?)",?$/gm),
].map((m) => m[1]);
if (fragments.length !== 9) throw new Error("Unexpected statement event fragments.");
const abi = javascript.match(/export const staticsAbi = parseAbi\(\[([\s\S]*?)\]\);/);
if (!abi) throw new Error("Missing legacy ABI.");
const binding = `export const staticsAbi = [...parseAbi([${abi[1]}]), ...parseAbi(${JSON.stringify(fragments)})] as const;`;
const input = resolve(scratch, "statement-abi.ts");
writeFileSync(input, 'import { parseAbi } from "viem";\n' + binding);
const program = ts.createProgram([input], {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  declaration: true,
  skipLibCheck: true,
  strict: true,
});
const result = program.emit(),
  diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics];
if (diagnostics.length)
  throw new Error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    })
  );
const generatedDeclaration = readFileSync(resolve(scratch, "statement-abi.d.ts"), "utf8");
const tree = ts.createSourceFile("index.d.ts", declarations, ts.ScriptTarget.Latest, true);
const declaration = tree.statements.find(
  (node) =>
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.some((d) => d.name.getText(tree) === "staticsAbi")
);
if (!declaration) throw new Error("Missing legacy ABI declaration.");
declarations =
  declarations.slice(0, declaration.getStart(tree)) +
  generatedDeclaration +
  declarations.slice(declaration.end);
javascript = javascript.replace(abi[0], binding.replace(" as const", ""));
const exports =
  '\nexport { staticsRangeGaugeAbi, staticsGaugeIncentivesAbi, buildSetNonSwapStakerShareBpsCall, buildNonSwapStakerShareBpsCall, decodeNonSwapStakerShareBpsResult } from "./phase-one/index.js";\n';
javascript += exports;
declarations +=
  exports +
  'export type { LiquidityStatementMovement, RebalanceSettlement, RangeGaugeEventName, RangeGaugeEventArgs, GaugeIncentiveEventName, GaugeIncentiveEventArgs } from "./phase-one/index.js";\n';
writeFileSync(resolve(destination, "dist/index.js"), javascript);
writeFileSync(resolve(destination, "dist/index.d.ts"), declarations);
provenance.positionStatementLegacyArtifactsCommit = legacyCommit;
function inventory(directory, prefix = "dist") {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) inventory(resolve(directory, entry.name), `${prefix}/${entry.name}`);
    else
      provenance.checksums[`${prefix}/${entry.name}`] = checksum(
        readFileSync(resolve(directory, entry.name))
      );
  }
}
inventory(resolve(destination, "dist"));
provenance.positionStatementSource = {
  repository: "https://github.com/EqualFiLabs/statics-sdk",
  path: ".",
  commit,
};
provenance.positionStatementSourceChecksums = Object.fromEntries(
  ["src/index.ts", "src/range-gauges.ts", "src/gauge-incentives.ts", "package.json"].map((file) => [
    file,
    checksum(readFileSync(resolve(checkout, file))),
  ])
);
writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`Vendored position statement SDK at ${commit}.`);
