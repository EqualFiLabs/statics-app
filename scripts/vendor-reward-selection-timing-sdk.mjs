import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Keep the existing Genesis, Phase 1 and batch bindings intact when adding the timing view.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.STATICS_REWARD_SELECTION_TIMING_SDK_REPOSITORY?.trim();
if (!source)
  throw new Error("Set STATICS_REWARD_SELECTION_TIMING_SDK_REPOSITORY to a clean SDK checkout.");
const checkout = resolve(root, source);
const git = (...args) => execFileSync("git", args, { cwd: checkout, encoding: "utf8" }).trim();
if (git("status", "--porcelain")) throw new Error("The timing SDK checkout must be clean.");
const commit = git("rev-parse", "HEAD");
execFileSync("npm", ["run", "build"], { cwd: checkout, stdio: "inherit" });
const destination = resolve(root, "vendor/statics-sdk");
const provenancePath = resolve(destination, "provenance.json");
const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
const checksum = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const extension of ["js", "d.ts"]) {
  const file = `dist/position-market.${extension}`;
  const bytes = readFileSync(resolve(checkout, file));
  writeFileSync(resolve(destination, file), bytes);
  provenance.checksums[file] = checksum(bytes);
  const index = `dist/index.${extension}`;
  let content = readFileSync(resolve(destination, index), "utf8");
  const statement = 'export * from "./position-market.js";';
  if (!content.includes(statement)) content += `\n${statement}\n`;
  writeFileSync(resolve(destination, index), content);
  provenance.checksums[index] = checksum(content);
}
provenance.rewardSelectionTimingSource = {
  repository: "https://github.com/EqualFiLabs/statics-sdk",
  path: ".",
  commit,
};
provenance.rewardSelectionTimingSourceChecksums = Object.fromEntries(
  ["src/position-market.ts", "package.json"].map((file) => [
    file,
    checksum(readFileSync(resolve(checkout, file))),
  ])
);
writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`Vendored reward selection timing SDK at ${commit}.`);
