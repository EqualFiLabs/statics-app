import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("vendored Statics SDK", () => {
  it("pins a protocol commit and verifies every copied artifact", () => {
    const provenance = JSON.parse(
      readFileSync(resolve(root, "vendor/statics-sdk/provenance.json"), "utf8")
    ) as {
      protocolCommit: string;
      source: { repository: string; path: string; commit: string };
      sdkTreeState: "clean" | "dirty";
      sourceChecksums: Record<string, string>;
      checksums: Record<string, string>;
    };
    expect(provenance.protocolCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(provenance.source).toEqual({
      repository: "https://github.com/EqualFiLabs/statics-sdk",
      path: ".",
      commit: expect.stringMatching(/^[a-f0-9]{40}$/),
    });
    expect(["clean", "dirty"]).toContain(provenance.sdkTreeState);
    expect(Object.keys(provenance.sourceChecksums).sort()).toEqual([
      "package.json",
      "src/index.ts",
    ]);
    for (const expected of Object.values(provenance.sourceChecksums)) {
      expect(expected).toMatch(/^[a-f0-9]{64}$/);
    }
    for (const [file, expected] of Object.entries(provenance.checksums)) {
      const actual = createHash("sha256")
        .update(readFileSync(resolve(root, "vendor/statics-sdk", file)))
        .digest("hex");
      expect(actual, file).toBe(expected);
    }
  });

  it("installs from the repository-local vendor package", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(packageJson.dependencies["@statics-protocol/sdk"]).toBe("file:vendor/statics-sdk");
  });
});
