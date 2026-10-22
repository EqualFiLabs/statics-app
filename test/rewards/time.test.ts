import { describe, expect, it } from "vitest";

import { formatDuration } from "@/lib/rewards/time";

describe("formatDuration", () => {
  it("formats minutes, hours and days", () => {
    expect(formatDuration(0n)).toBe("1m");
    expect(formatDuration(-5n)).toBe("1m");
    expect(formatDuration(90n)).toBe("2m");
    expect(formatDuration(3_600n)).toBe("1h 0m");
    expect(formatDuration(3_661n)).toBe("1h 2m");
    expect(formatDuration(90_000n)).toBe("1d 1h");
  });

  it("carries a rounded-up minute into the hour", () => {
    expect(formatDuration(3_599n)).toBe("1h 0m");
    expect(formatDuration(7_199n)).toBe("2h 0m");
    expect(formatDuration(86_399n)).toBe("1d 0h");
  });
});
