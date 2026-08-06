import { serializeSignature } from "viem";
import { describe, expect, it, vi } from "vitest";

import {
  PERMIT_TTL_SECONDS,
  decodePermitSignature,
  exactPeggedMintPermitValue,
  permitDeadline,
  privyPermitRequest,
  signPermitForWallet,
} from "@/lib/dollar/permit";

describe("Dollar permit helpers", () => {
  it("uses a short block-timestamp deadline", () => {
    expect(permitDeadline(1_000n)).toBe(1_000n + PERMIT_TTL_SECONDS);
  });

  it("normalizes a wallet signature for the gateway ABI", () => {
    const signature = serializeSignature({
      r: `0x${"11".repeat(32)}`,
      s: `0x${"22".repeat(32)}`,
      yParity: 1,
    });
    expect(decodePermitSignature(2n ** 256n - 1n, 2_000n, signature)).toEqual({
      value: 2n ** 256n - 1n,
      deadline: 2_000n,
      v: 28,
      r: `0x${"11".repeat(32)}`,
      s: `0x${"22".repeat(32)}`,
    });
  });

  it("signs the fresh exact amount within the reviewed maximum", () => {
    expect(exactPeggedMintPermitValue(100n, 105n)).toBe(100n);
    expect(() => exactPeggedMintPermitValue(106n, 105n)).toThrow(
      "The required USDG moved above the reviewed maximum."
    );
  });

  it("uses Privy's signer directly for embedded-wallet permits", async () => {
    const embedded = vi.fn().mockResolvedValue("0x11" as const);
    const external = vi.fn().mockResolvedValue("0x22" as const);

    await expect(
      signPermitForWallet({
        walletKind: "embedded",
        typedData: { primaryType: "Permit" },
        signEmbedded: embedded,
        signExternal: external,
      })
    ).resolves.toBe("0x11");
    expect(embedded).toHaveBeenCalledOnce();
    expect(external).not.toHaveBeenCalled();
  });

  it("keeps the intermediate embedded permit headless", () => {
    const typedData = {
      domain: {
        name: "Mock USDG",
        version: "1",
        chainId: 46_630,
        verifyingContract: "0x0000000000000000000000000000000000000001",
      },
      types: {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Permit",
      message: {
        owner: "0x0000000000000000000000000000000000000002",
        spender: "0x0000000000000000000000000000000000000003",
        value: 123n,
        nonce: 4n,
        deadline: 567n,
      },
    } as const;

    const request = privyPermitRequest(typedData, "0x0000000000000000000000000000000000000002");

    expect(request.typedData.message).toMatchObject({
      value: "123",
      nonce: "4",
      deadline: "567",
    });
    expect(request.options).toEqual({
      address: "0x0000000000000000000000000000000000000002",
      uiOptions: {
        showWalletUIs: false,
      },
    });
    expect(() => JSON.stringify(request)).not.toThrow();
    expect(typedData.message.value).toBe(123n);
  });

  it("keeps external-wallet permits on their provider signer", async () => {
    const embedded = vi.fn().mockResolvedValue("0x11" as const);
    const external = vi.fn().mockResolvedValue("0x22" as const);

    await expect(
      signPermitForWallet({
        walletKind: "external",
        typedData: { primaryType: "Permit" },
        signEmbedded: embedded,
        signExternal: external,
      })
    ).resolves.toBe("0x22");
    expect(external).toHaveBeenCalledOnce();
    expect(embedded).not.toHaveBeenCalled();
  });
});
