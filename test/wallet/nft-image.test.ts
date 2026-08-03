import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import { resolveNftImage } from "@/lib/wallet/nft-image";

const contract = "0x1111111111111111111111111111111111111111" as const;

describe("NFT artwork resolution", () => {
  it("returns self-contained PositionNFT SVG artwork from onchain metadata", async () => {
    const image = `data:image/svg+xml;base64,${btoa("<svg xmlns='http://www.w3.org/2000/svg'/>")}`;
    const metadata = btoa(JSON.stringify({ name: "Statics Position #7", image }));
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(`data:application/json;base64,${metadata}`),
    } as unknown as PublicClient;

    await expect(resolveNftImage(publicClient, contract, 7n)).resolves.toBe(image);
  });

  it("keeps missing metadata as a non-throwing placeholder outcome", async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(""),
    } as unknown as PublicClient;

    await expect(resolveNftImage(publicClient, contract, 7n)).resolves.toBeNull();
  });
});
