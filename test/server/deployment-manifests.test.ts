// @vitest-environment node
import {
  mkdtempSync,
  readdirSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/deployments/route";
import {
  deploymentScopedCache,
  readPublicDeploymentSnapshot,
  serverDeploymentRegistry,
  withDeploymentSnapshot,
} from "@/lib/server/deployment-manifests";
import { runtimeManifests } from "@/test/fixtures/public-manifests";

let dir: string;
let path: string;
function publish(value = runtimeManifests()) {
  writeFileSync(join(dir, "candidate.json"), JSON.stringify(value));
  renameSync(join(dir, "candidate.json"), path);
}
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "statics-runtime-manifests-"));
  path = join(dir, "active.json");
  vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
  vi.stubEnv("STATICS_RUNTIME_MANIFEST_PATH", path);
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const file of readdirSync(dir)) unlinkSync(join(dir, file));
  rmdirSync(dir);
});

describe("runtime manifest server", () => {
  it("uses checked-in configuration only when no runtime file is configured", () => {
    vi.stubEnv("STATICS_RUNTIME_MANIFEST_PATH", "");
    expect(readPublicDeploymentSnapshot().source).toBe("checked-in-manifest");
    expect(serverDeploymentRegistry()[0].launch).not.toBeNull();
  });

  it("observes atomic file replacement without a rebuild or process restart", async () => {
    publish();
    const first = readPublicDeploymentSnapshot();
    const changed = runtimeManifests();
    changed.phaseOne["robinhood-phase-one"].contracts.diamond.address = `0x${"6".repeat(40)}`;
    publish(changed);
    const next = readPublicDeploymentSnapshot();
    expect(next.revision).not.toBe(first.revision);
    expect(serverDeploymentRegistry(next)[0].phaseOne?.contracts.diamond).toBe(
      `0x${"6".repeat(40)}`
    );
    const response = GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      revision: next.revision,
      source: "runtime-manifest",
    });
  });

  it("fails closed for absent, malformed, oversized and relative files without leaking paths", async () => {
    for (const contents of [
      undefined,
      "not JSON",
      JSON.stringify({ schemaVersion: 1 }),
      "x".repeat(2 * 1024 * 1024 + 1),
    ]) {
      if (contents !== undefined) writeFileSync(path, contents);
      expect(() => readPublicDeploymentSnapshot()).toThrow(
        "Public deployment configuration is unavailable."
      );
      const response = GET();
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain(dir);
    }
    vi.stubEnv("STATICS_RUNTIME_MANIFEST_PATH", "relative.json");
    expect(() => readPublicDeploymentSnapshot()).toThrow("unavailable");
  });

  it("pins one request across a concurrent manifest switch, while new requests see the new release", async () => {
    publish();
    const old = readPublicDeploymentSnapshot();
    await withDeploymentSnapshot(async () => {
      publish({ schemaVersion: 1, launch: {}, phaseOne: {}, protocol: {} });
      await Promise.resolve();
      expect(readPublicDeploymentSnapshot().revision).toBe(old.revision);
      expect(serverDeploymentRegistry()[0].phaseOne).not.toBeNull();
    });
    expect(serverDeploymentRegistry()[0].phaseOne).toBeNull();
  });

  it("separates analytics caches and unfinished requests by release", async () => {
    const cache = deploymentScopedCache(() => ({ value: "empty" }));
    publish();
    let finish!: () => void;
    const pending = withDeploymentSnapshot(async () => {
      const state = cache();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      state.value = "old request";
    });
    publish({ schemaVersion: 1, launch: {}, phaseOne: {}, protocol: {} });
    const current = cache();
    expect(current.value).toBe("empty");
    finish();
    await pending;
    expect(cache()).toBe(current);
    expect(current.value).toBe("empty");
    writeFileSync(path, "broken");
    expect(() => cache()).toThrow("unavailable");
  });
});
