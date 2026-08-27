import { renderWithLocale, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";

import { WalletNftList } from "@/components/wallet/WalletNftList";
import spanish from "@/messages/es.json";

describe("wallet NFT list localization", () => {
  it("renders its empty state in Spanish", () => {
    renderWithLocale(
      <WalletNftList nfts={[]} chainId={4_663} onTransfer={vi.fn()} />,
      "es",
      spanish
    );

    expect(screen.getByRole("heading", { name: "Aún no hay NFT" })).toBeInTheDocument();
    expect(
      screen.getByText(/Las posiciones y las posiciones de liquidez aparecen aquí/)
    ).toBeInTheDocument();
  });
});
