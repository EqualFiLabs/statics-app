import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor, readLimit } from "../src/api/pagination";

describe("indexer pagination", () => {
  it("round trips opaque bigint cursors", () => {
    expect(decodeCursor(encodeCursor(12345678901234567890n))).toBe(12345678901234567890n);
  });

  it("rejects malformed cursors and out-of-range limits", () => {
    expect(decodeCursor("not-a-decimal-cursor")).toBeNull();
    expect(readLimit("0")).toBe(0);
    expect(readLimit("101")).toBe(0);
    expect(readLimit(undefined)).toBe(100);
  });
});
