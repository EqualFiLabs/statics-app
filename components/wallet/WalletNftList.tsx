"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { NftArtwork } from "@/components/wallet/NftArtwork";

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
  chainId,
  onTransfer,
}: Readonly<{
  nfts: readonly WalletNft[];
  chainId: number;
  onTransfer: (nft: WalletNft) => void;
}>) {
  const t = useTranslations("wallet");
  if (nfts.length === 0) {
    return (
      <div className="ui-empty">
        <h3 className="ui-empty-title">{t("noNfts")}</h3>
        <p className="ui-empty-description">{t("noNftsDescription")}</p>
      </div>
    );
  }

  return (
    <div className="wallet-nft-rows">
      {nfts.map((nft) => (
        <article
          className="wallet-nft-row"
          key={`${chainId}:${nft.contract.toLowerCase()}:${nft.tokenId}`}
        >
          <div className="wallet-nft-top">
            <div className="wallet-nft-detail">
              <strong>{nft.name}</strong>
              <span>{nft.summary}</span>
              {nft.carries.length > 0 && (
                <p className="wallet-nft-carries">
                  {t("movesWithIt", { assets: nft.carries.join(", ") })}
                </p>
              )}
              {nft.transferWarning && <p className="wallet-nft-carries">{nft.transferWarning}</p>}
              {nft.blockedReason && <p className="wallet-nft-blocked">{nft.blockedReason}</p>}
            </div>
            <NftArtwork nft={nft} chainId={chainId} expandable />
          </div>
          <button
            className="wallet-nft-send"
            type="button"
            onClick={() => onTransfer(nft)}
            disabled={nft.blockedReason !== null}
          >
            <ArrowUpRight size={14} aria-hidden="true" />
            {t("send")}
          </button>
        </article>
      ))}
    </div>
  );
}
