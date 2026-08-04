import { describe, expect, it } from "vitest";

import { deriveSurfaceState, isSurfaceReady, type SurfaceStateInput } from "@/lib/surface-state";

const base: SurfaceStateInput = {
  walletStatus: "ready",
  isTargetChain: true,
  isLoading: false,
  isError: false,
  isEmpty: false,
  hasData: true,
};

const state = (overrides: Partial<SurfaceStateInput> = {}) =>
  deriveSurfaceState({ ...base, ...overrides });

describe("surface state", () => {
  it("separates the three things that used to render an identical placeholder", () => {
    // The bug this exists to prevent: disconnected, loading and failed all
    // collapsing into one branch, leaving a visitor unable to tell which.
    expect(state({ walletStatus: "disconnected", hasData: false })).toBe("disconnected");
    expect(state({ isLoading: true, hasData: false })).toBe("loading");
    expect(state({ isError: true, hasData: false })).toBe("error");
    expect(state({ isEmpty: true })).toBe("empty");

    const kinds = new Set([
      state({ walletStatus: "disconnected", hasData: false }),
      state({ isLoading: true, hasData: false }),
      state({ isError: true, hasData: false }),
      state({ isEmpty: true }),
    ]);
    expect(kinds.size).toBe(4);
  });

  it("never reports empty when the reason is really the wallet", () => {
    // "You have no positions" is a false statement when no wallet is connected.
    for (const walletStatus of ["disconnected", "loading", "error"] as const) {
      expect(state({ walletStatus, isEmpty: true, hasData: false })).not.toBe("empty");
    }
    expect(state({ isTargetChain: false, isEmpty: true, hasData: false })).not.toBe("empty");
  });

  it("treats an unusable wallet connection as disconnected", () => {
    expect(state({ walletStatus: "error" })).toBe("disconnected");
  });

  it("reports a chain mismatch ahead of the read's own state", () => {
    expect(state({ isTargetChain: false, isLoading: true, hasData: false })).toBe("wrong-network");
  });

  it("keeps showing good data through a background refetch or a failed one", () => {
    // Replacing a populated screen with a spinner or an error is worse than
    // showing numbers that are a moment stale.
    expect(state({ isLoading: true, hasData: true })).toBe("ready");
    expect(state({ isError: true, hasData: true })).toBe("ready");
    expect(state({ isError: true, hasData: true, isEmpty: true })).toBe("empty");
  });

  it("passes an unconfigured deployment through untouched", () => {
    expect(state({ walletStatus: "unconfigured" })).toBe("unconfigured");
  });

  it("only calls the surface ready when there is something to render", () => {
    expect(isSurfaceReady("ready")).toBe(true);
    for (const kind of [
      "unconfigured",
      "disconnected",
      "wrong-network",
      "loading",
      "error",
      "empty",
    ] as const) {
      expect(isSurfaceReady(kind), kind).toBe(false);
    }
  });
});
