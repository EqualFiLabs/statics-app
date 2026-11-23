import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sdk = process.env.STATICS_CONVERSION_SDK_REPOSITORY?.trim();
if (!sdk)
  throw new Error("Set STATICS_CONVERSION_SDK_REPOSITORY to a clean conversion SDK checkout.");
const git = (...args) => execFileSync("git", args, { cwd: sdk, encoding: "utf8" }).trim();
if (git("status", "--porcelain", "--untracked-files=all"))
  throw new Error("Conversion SDK checkout is dirty.");
execFileSync("npm", ["run", "build"], { cwd: sdk, stdio: "inherit" });

const destination = new URL("../vendor/statics-sdk/", import.meta.url);
const packagePath = new URL("package.json", destination);
const provenancePath = new URL("provenance.json", destination);
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
const checksum = (bytes) => createHash("sha256").update(bytes).digest("hex");

for (const file of ["dist/basket-conversion.js", "dist/basket-conversion.d.ts"]) {
  const bytes = readFileSync(resolve(sdk, file));
  writeFileSync(new URL(file, destination), bytes);
  provenance.checksums[file] = checksum(bytes);
}
pkg.exports["./basket-conversion"] = {
  types: "./dist/basket-conversion.d.ts",
  import: "./dist/basket-conversion.js",
};
provenance.basketConversionSource = {
  repository: "https://github.com/EqualFiLabs/statics-sdk",
  path: ".",
  commit: git("rev-parse", "HEAD"),
};
provenance.basketConversionSourceChecksums = {
  "src/basket-conversion.ts": checksum(readFileSync(resolve(sdk, "src/basket-conversion.ts"))),
};
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
