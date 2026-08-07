import { describe, expect, it } from "vitest";

import {
  EVE_DECIMAL_CONVERSION_RATE,
  bufferedLayerZeroFee,
  createEveSendParam,
  getEveBridgeDeployment,
  getEveBridgeDestination,
  isEveToken,
  normalizeEveBridgeAmount,
} from "@/lib/portal/eve-bridge";

describe("EVE bridge deployment registry", () => {
  it("resolves the active Base and Robinhood pathway", () => {
    expect(getEveBridgeDestination(8_453)).toMatchObject({ chainId: 4_663, eid: 30_416 });
    expect(getEveBridgeDestination(4_663)).toMatchObject({ chainId: 8_453, eid: 30_184 });
    expect(getEveBridgeDestination(8_453, 1)).toBeNull();
  });

  it("matches EVE by chain and address rather than symbol", () => {
    const base = getEveBridgeDeployment(8_453)!;
    expect(isEveToken(8_453, base.tokenAddress.toLowerCase())).toBe(true);
    expect(isEveToken(4_663, base.tokenAddress)).toBe(false);
    expect(isEveToken(8_453, undefined)).toBe(false);
  });

  it("uses the six-shared-decimal conversion unit", () => {
    expect(EVE_DECIMAL_CONVERSION_RATE).toBe(1_000_000_000_000n);
    expect(normalizeEveBridgeAmount(1_234_567_890_123n)).toBe(1_000_000_000_000n);
    expect(bufferedLayerZeroFee(101n)).toBe(122n);
  });

  it("builds an exact, enforced-options send parameter", () => {
    expect(
      createEveSendParam(
        8_453,
        4_663,
        "0x0000000000000000000000000000000000000001",
        1_234_567_890_123n
      )
    ).toEqual({
      dstEid: 30_416,
      to: "0x0000000000000000000000000000000000000000000000000000000000000001",
      amountLD: 1_000_000_000_000n,
      minAmountLD: 1_000_000_000_000n,
      extraOptions: "0x",
      composeMsg: "0x",
      oftCmd: "0x",
    });
    expect(() =>
      createEveSendParam(
        8_453,
        4_663,
        "0x0000000000000000000000000000000000000001",
        EVE_DECIMAL_CONVERSION_RATE - 1n
      )
    ).toThrow("minimum bridge amount");
  });
});
