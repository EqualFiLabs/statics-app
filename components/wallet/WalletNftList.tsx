"use client";

import { ArrowUpRight, Boxes, Droplets } from "lucide-react";

import type { WalletNft } from "@/lib/wallet/nfts";

/**
 * The NFTs a wallet holds, and the way out of them.
 *
 * Positions and liquidity positions are both ERC-721s the holder owns, so the
 * wallet is where someone looks for them and where they expect to be able to
 * move them. Keeping transfer here rather than on the Positions page means one
 * place to reason about, and one place to get the warnings right.
 *
 * `carries` is rendered prominently rather than tucked into the dialog:
 * transferring a position hands over its collateral, staking and rewards, and
 * that has to be legible before the transfer is opened, not after.
 */
export function WalletNftList({
  nfts,
  onTransfer,
}: Readonly<{
  nfts: readonly WalletNft[];
  onTransfer: (nft: WalletNft) => void;
}>) {
  if (nfts.length === 0) {
    return (
      <div className="ui-empty">
        <h3 className="ui-empty-title">No NFTs yet</h3>
        <p className="ui-empty-description">
          Positions and liquidity positions appear here. Buy a basket or supply liquidity and the
          NFT that represents it shows up in your wallet.
        </p>
      </div>
    );
  }

  return (
    <div className="wallet-nft-rows">
      {nfts.map((nft) => {
        const Icon = nft.kind === "position" ? Boxes : Droplets;
        return (
          <article className="wallet-nft-row" key={`${nft.kind}:${nft.tokenId}`}>
            <span className="wallet-nft-icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <div className="wallet-nft-detail">
              <strong>{nft.name}</strong>
              <span>{nft.summary}</span>
              {nft.carries.length > 0 && (
                <p className="wallet-nft-carries">Moves with it: {nft.carries.join(", ")}</p>
              )}
              {nft.blockedReason && <p className="wallet-nft-blocked">{nft.blockedReason}</p>}
            </div>
            <button
              className="wallet-nft-send"
              type="button"
              onClick={() => onTransfer(nft)}
              disabled={nft.blockedReason !== null}
            >
              <ArrowUpRight size={14} aria-hidden="true" />
              Send
            </button>
          </article>
        );
      })}
    </div>
  );
}
