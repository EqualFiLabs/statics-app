import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Overlay the independently versioned batch module without replacing the legacy
// Genesis/Dollar or Phase 1 compatibility artifacts used by the rest of the app.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.STATICS_BATCH_REWARDS_SDK_REPOSITORY?.trim();
if (!source) throw new Error("Set STATICS_BATCH_REWARDS_SDK_REPOSITORY to a clean SDK checkout.");
const checkout = resolve(root, source);
const git = (...args) => execFileSync("git", args, { cwd: checkout, encoding: "utf8" }).trim();
if (git("status", "--porcelain")) throw new Error("The batch SDK checkout must be clean.");
const commit = git("rev-parse", "HEAD");
execFileSync("npm", ["run", "build"], { cwd: checkout, stdio: "inherit" });
const destination = resolve(root, "vendor/statics-sdk");
const provenancePath = resolve(destination, "provenance.json");
const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
const checksum = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const extension of ["js", "d.ts"]) {
  const file = `dist/batch-rewards.${extension}`;
  const bytes = readFileSync(resolve(checkout, file));
  writeFileSync(resolve(destination, file), bytes);
  provenance.checksums[file] = checksum(bytes);
  const index = `dist/index.${extension}`;
  let content = readFileSync(resolve(destination, index), "utf8");
  const statement = 'export * from "./batch-rewards.js";';
  if (!content.includes(statement)) content += `\n${statement}\n`;
  writeFileSync(resolve(destination, index), content);
  provenance.checksums[index] = checksum(content);
}
provenance.batchRewardsSource = {
  repository: "https://github.com/EqualFiLabs/statics-sdk",
  path: ".",
  commit,
};
provenance.batchRewardsSourceChecksums = Object.fromEntries(
  ["src/batch-rewards.ts", "package.json"].map((file) => [
    file,
    checksum(readFileSync(resolve(checkout, file))),
  ])
);
writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`Vendored batch rewards SDK at ${commit}.`);
