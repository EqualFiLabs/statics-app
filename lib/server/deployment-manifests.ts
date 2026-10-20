import { AsyncLocalStorage } from "node:async_hooks";
import { closeSync, fstatSync, openSync, readFileSync } from "node:fs";
import { isAbsolute } from "node:path";

import {
  checkedInDeploymentSnapshot,
  parsePublicDeploymentManifests,
  publicDeploymentSnapshot,
  type PublicDeploymentSnapshot,
} from "@/lib/deployments/public-manifests";
import { deploymentRegistry } from "@/lib/deployments/registry";

const requestSnapshot = new AsyncLocalStorage<PublicDeploymentSnapshot>();

const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
let lastFile: { path: string; data: string; snapshot: PublicDeploymentSnapshot } | undefined;
let bundledSnapshot: PublicDeploymentSnapshot | undefined;

/** Read a complete, atomically published file on every request. No RPC or remote URL. */
export function readPublicDeploymentSnapshot(): PublicDeploymentSnapshot {
  const pinned = requestSnapshot.getStore();
  if (pinned) return pinned;
  const path = process.env.STATICS_RUNTIME_MANIFEST_PATH?.trim();
  if (!path) return (bundledSnapshot ??= checkedInDeploymentSnapshot());
  let fd: number | undefined;
  try {
    if (!isAbsolute(path)) throw new Error("Expected an absolute manifest path.");
    fd = openSync(path, "r");
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_MANIFEST_BYTES) throw new Error("Invalid manifest file.");
    const data = readFileSync(fd, "utf8");
    if (Buffer.byteLength(data) > MAX_MANIFEST_BYTES) throw new Error("Manifest is too large.");
    if (lastFile?.path === path && lastFile.data === data) return lastFile.snapshot;
    const snapshot = publicDeploymentSnapshot(
      parsePublicDeploymentManifests(JSON.parse(data)),
      "runtime-manifest"
    );
    lastFile = { path, data, snapshot };
    return snapshot;
  } catch {
    // Never fall back to old compiled addresses or expose server filesystem paths.
    throw new Error("Public deployment configuration is unavailable.");
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function serverDeploymentRegistry(snapshot = readPublicDeploymentSnapshot()) {
  return deploymentRegistry(undefined, snapshot);
}

/** Nested server reads share the request's snapshot even across an atomic file switch. */
export function withDeploymentSnapshot<T>(work: () => T): T {
  return requestSnapshot.run(readPublicDeploymentSnapshot(), work);
}

/** Existing analytics lifetimes are retained, but releases never share cached results. */
export function deploymentScopedCache<T>(create: () => T): () => T {
  const releases = new Map<string, T>();
  return () => {
    const snapshot = readPublicDeploymentSnapshot();
    const key = `${snapshot.source}:${snapshot.revision}`;
    let state = releases.get(key);
    if (!state) {
      state = create();
      releases.set(key, state);
      if (releases.size > 4) releases.delete(releases.keys().next().value!);
    }
    return state;
  };
}
