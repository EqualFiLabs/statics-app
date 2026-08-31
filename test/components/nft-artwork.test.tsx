import { fireEvent, render, screen, waitFor } from "@/test/render";
import { describe, expect, it } from "vitest";

import { NftArtwork } from "@/components/wallet/NftArtwork";

const operator = {
  kind: "collection" as const,
  tokenId: 4n,
  contract: "0xad5E9F96A91D1A6F550580b157af2068A0e8F0BE" as const,
  name: "Operator #4",
  summary: "Tier 2",
  carries: [],
  blockedReason: null,
};

describe("local NFT artwork", () => {
  it("opens local Operator artwork with its current tier and restores focus", async () => {
    render(<NftArtwork nft={operator} chainId={4663} operatorTier={2} expandable />);
    const trigger = screen.getByRole("button", { name: "View Operator #4 full size" });
    expect(trigger.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/operators/3ae699e07a0b5ba9/4.svg"
    );
    expect(trigger.querySelectorAll(".operator-tier-overlay i")).toHaveLength(2);

    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Operator #4 artwork" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("renders PositionNFT artwork locally without a metadata request", () => {
    render(
      <NftArtwork
        chainId={46630}
        nft={{ ...operator, kind: "position", tokenId: 42n, name: "Position #42" }}
      />
    );
    const image = document.querySelector("img.wallet-nft-art");
    expect(image?.getAttribute("src")).toContain("POSITION%20%2342");
  });

  it("uses a noninteractive placeholder for arbitrary collection media", () => {
    render(
      <NftArtwork
        chainId={1}
        expandable
        nft={{
          ...operator,
          contract: "0x0000000000000000000000000000000000000004",
          name: "Third-party NFT",
        }}
      />
    );
    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.querySelector(".wallet-nft-art.is-placeholder")).toBeInTheDocument();
  });
});
