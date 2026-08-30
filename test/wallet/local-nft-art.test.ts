import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  loadOperatorTraits,
  operatorArtwork,
  positionArtworkDataUri,
} from "@/lib/wallet/local-nft-art";

const collection = "0xad5E9F96A91D1A6F550580b157af2068A0e8F0BE" as const;

describe("deterministic Statics artwork", () => {
  it("maps only the reviewed Operator collection and supply", () => {
    expect(operatorArtwork(4663, collection, 1n)?.src).toBe(
      "/assets/operators/3ae699e07a0b5ba9/1.svg"
    );
    expect(operatorArtwork(46630, collection, 1n)).toBeNull();
    expect(operatorArtwork(4663, collection, 5556n)).toBeNull();
  });

  it("loads immutable traits from the local SVG metadata", async () => {
    const svg = await readFile(
      join(process.cwd(), "public/assets/operators/3ae699e07a0b5ba9/1.svg"),
      "utf8"
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(svg, { status: 200, headers: { "content-type": "image/svg+xml" } })
      );
    const traits = await loadOperatorTraits(4663, collection, 1n);
    expect(traits).toHaveLength(8);
    expect(traits.find((trait) => trait.label === "Signal")?.value).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/assets/operators/3ae699e07a0b5ba9/1.svg",
      expect.objectContaining({ signal: undefined })
    );
    fetchMock.mockRestore();
  });

  it("ports the pure PositionNFT renderer without RPC input", () => {
    const uri = positionArtworkDataUri(42n);
    expect(decodeURIComponent(uri)).toContain("Statics Position #42");
    expect(decodeURIComponent(uri)).toContain("POSITION #42");
  });
});
