import { describe, expect, it } from "vitest";

import { describeTransportFailure } from "@/lib/protocol/errors";

describe("protocol transport errors", () => {
  it("does not expose low-level Anvil transport details", () => {
    expect(
      describeTransportFailure(
        "HTTP request failed. URL: http://127.0.0.1:8545/ Details: Failed to fetch"
      )
    ).toBe("Local Anvil unavailable.");
  });

  it("leaves non-transport failures for domain-specific translation", () => {
    expect(describeTransportFailure("BasketNotActive")).toBeNull();
  });
});
