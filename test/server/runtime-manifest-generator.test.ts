// @vitest-environment node
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  parsePublicDeploymentManifests,
  publicDeploymentSnapshot,
} from "@/lib/deployments/public-manifests";
import { runtimeManifests } from "@/test/fixtures/public-manifests";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "statics-manifest-generator-"));
});
afterEach(() => {
  for (const file of readdirSync(dir)) unlinkSync(join(dir, file));
  rmdirSync(dir);
});
function run(args: string[]) {
  return execFileSync(process.execPath, ["scripts/generate-runtime-manifests.mjs", ...args], {
    encoding: "utf8",
    stdio: "pipe",
  });
}

it("assembles a valid runtime candidate with inherited records and matching revision", () => {
  const phase = join(dir, "phase.json");
  const output = join(dir, "release.json");
  writeFileSync(phase, JSON.stringify(runtimeManifests().phaseOne["robinhood-phase-one"]));
  const result = run(["--manifest", phase, "--output", output]);
  const candidate = parsePublicDeploymentManifests(JSON.parse(readFileSync(output, "utf8")));
  expect(candidate.launch["robinhood-genesis"]).toBeDefined();
  expect(candidate.phaseOne["robinhood-phase-one"]).toBeDefined();
  expect(result).toContain(publicDeploymentSnapshot(candidate, "runtime-manifest").revision);
  expect(() => run(["--output", output])).toThrow();
  expect(readFileSync(output, "utf8")).toContain("robinhood-phase-one");
});

it("preserves an explicit base and rejects local deployment input", () => {
  const base = join(dir, "base.json");
  const input = join(dir, "input.json");
  const output = join(dir, "release.json");
  writeFileSync(base, JSON.stringify({ schemaVersion: 1, launch: {}, phaseOne: {}, protocol: {} }));
  writeFileSync(input, JSON.stringify(runtimeManifests().phaseOne["robinhood-phase-one"]));
  run(["--base", base, "--manifest", input, "--output", output]);
  expect(JSON.parse(readFileSync(output, "utf8")).launch).toEqual({});
  writeFileSync(
    input,
    JSON.stringify({
      ...runtimeManifests().phaseOne["robinhood-phase-one"],
      deploymentId: "local-anvil-phase-one",
    })
  );
  expect(() => run(["--manifest", input, "--output", join(dir, "other.json")])).toThrow();
});
