import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@/test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NftArtwork } from "@/components/wallet/NftArtwork";

const mocks = vi.hoisted(() => ({
  resolveNftImage: vi.fn(),
}));

vi.mock("wagmi", () => ({
  usePublicClient: () => ({}),
}));

vi.mock("@/lib/wallet/nft-image", () => ({
  resolveNftImage: mocks.resolveNftImage,
}));

const nft = {
  kind: "collection" as const,
  tokenId: 4n,
  contract: "0x0000000000000000000000000000000000000004" as const,
  name: "Genesis #4",
  summary: "Tier 2",
  carries: [],
  blockedReason: null,
};

function renderArtwork(expandable = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NftArtwork nft={nft} chainId={46630} expandable={expandable} />
    </QueryClientProvider>
  );
}

describe("NFT artwork viewer", () => {
  beforeEach(() => {
    mocks.resolveNftImage.mockReset();
    mocks.resolveNftImage.mockResolvedValue(
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
    );
  });

  it("opens the resolved artwork, traps focus, and restores it after Escape", async () => {
    renderArtwork();
    const trigger = await screen.findByRole("button", {
      name: "View Genesis #4 full size",
    });

    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Genesis #4 artwork" });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Full-size artwork for Genesis #4" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes when the backdrop is pressed", async () => {
    renderArtwork();
    fireEvent.click(await screen.findByRole("button", { name: "View Genesis #4 full size" }));
    fireEvent.mouseDown(document.querySelector(".wallet-dialog-backdrop")!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaves ordinary thumbnails and missing artwork noninteractive", async () => {
    const first = renderArtwork(false);
    await waitFor(() =>
      expect(first.container.querySelector("img.wallet-nft-art")).toBeInTheDocument()
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    first.unmount();

    mocks.resolveNftImage.mockResolvedValueOnce(null);
    renderArtwork();
    await waitFor(() => expect(mocks.resolveNftImage).toHaveBeenCalled());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
