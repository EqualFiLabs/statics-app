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
      extensionSource?: { repository: string; path: string; commit: string };
      batchRewardsSource?: { repository: string; path: string; commit: string };
      batchRewardsSourceChecksums?: Record<string, string>;
      rewardSelectionTimingSource?: { repository: string; path: string; commit: string };
      rewardSelectionTimingSourceChecksums?: Record<string, string>;
      sdkTreeState: "clean" | "dirty";
      sourceChecksums: Record<string, string>;
      extensionSourceChecksums?: Record<string, string>;
      checksums: Record<string, string>;
    };
    expect(provenance.protocolCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(provenance.source).toEqual({
      repository: "https://github.com/EqualFiLabs/statics-sdk",
      path: ".",
      commit: expect.stringMatching(/^[a-f0-9]{40}$/),
    });
    expect(provenance.extensionSource).toEqual({
      repository: "https://github.com/EqualFiLabs/statics-sdk",
      path: ".",
      commit: expect.stringMatching(/^[a-f0-9]{40}$/),
    });
    expect(["clean", "dirty"]).toContain(provenance.sdkTreeState);
    expect(provenance.batchRewardsSource).toEqual({
      repository: "https://github.com/EqualFiLabs/statics-sdk",
      path: ".",
      commit: "672e26cb7a28f651740d5a9f6ff0951edf219f81",
    });
    expect(Object.keys(provenance.batchRewardsSourceChecksums ?? {}).sort()).toEqual([
      "package.json",
      "src/batch-rewards.ts",
    ]);
    expect(provenance.rewardSelectionTimingSource).toEqual({
      repository: "https://github.com/EqualFiLabs/statics-sdk",
      path: ".",
      commit: "498af5f864bbc8bbc9e5a65e68a182bf3b123898",
    });
    expect(Object.keys(provenance.rewardSelectionTimingSourceChecksums ?? {}).sort()).toEqual([
      "package.json",
      "src/position-market.ts",
    ]);
    expect(Object.keys(provenance.sourceChecksums).sort()).toEqual([
      "package.json",
      "src/index.ts",
    ]);
    expect(Object.keys(provenance.extensionSourceChecksums ?? {}).sort()).toEqual([
      "package.json",
      "src/genesis-credit.ts",
    ]);
    for (const expected of Object.values(provenance.sourceChecksums)) {
      expect(expected).toMatch(/^[a-f0-9]{64}$/);
    }
    for (const expected of Object.values(provenance.extensionSourceChecksums ?? {})) {
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
