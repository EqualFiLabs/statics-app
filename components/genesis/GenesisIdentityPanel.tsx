"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { NftArtwork } from "@/components/wallet/NftArtwork";
import { genesisTierMultiplier } from "@/components/genesis/GenesisTierLadder";
import { loadOperatorTraits } from "@/lib/wallet/local-nft-art";
import { formatTokenAmountGrouped } from "@/lib/protocol/ux";

/**
 * What this NFT *is*, as opposed to what you can do with it.
 *
 * Artwork, identity, traits, and backing live together on one side of the page
 * so the action panels opposite stay about a single decision each.
 */
export function GenesisIdentityPanel({
  id,
  tier,
  registered,
  rewardWeight,
  creditActive,
  chainId,
  collection,
  vaultPrice,
  maximumSupply,
}: Readonly<{
  id: bigint;
  tier: number;
  registered: boolean;
  rewardWeight: bigint;
  creditActive: boolean;
  chainId: number;
  collection: `0x${string}`;
  vaultPrice: bigint;
  maximumSupply: bigint;
}>) {
  const t = useTranslations("operators.identity");

  // Immutable traits are embedded in the checked-in SVG, so identity never
  // needs a tokenURI RPC even when the indexer is catching up.
  const metadata = useQuery({
    queryKey: ["genesis-traits", chainId, collection, id.toString()],
    staleTime: Infinity,
    retry: false,
    queryFn: ({ signal }) => loadOperatorTraits(chainId, collection, id, signal),
  });

  // The tier is already stated by the badge above, and the registry is a more
  // current source for it than cached metadata.
  const traits = metadata.data ?? [];

  return (
    <aside className="genesis-identity ui-card" aria-label={t("details", { id: id.toString() })}>
      <div className="genesis-identity-art">
        <NftArtwork
          chainId={chainId}
          operatorTier={tier}
          expandable
          size="lg"
          nft={{
            kind: "collection",
            tokenId: id,
            contract: collection,
            name: t("operator", { id: id.toString() }),
            summary: t("tier", { tier }),
            carries: [],
            blockedReason: creditActive ? t("repayBeforeTransfer") : null,
          }}
        />
      </div>

      <div className="genesis-identity-heading">
        <div>
          <h2 className="ui-section-title">{t("operator", { id: id.toString() })}</h2>
          <p className="genesis-identity-sub">
            {t("collectionPosition", { supply: maximumSupply.toString() })}
          </p>
        </div>
        <span className="genesis-tier-badge" data-tier={tier}>
          <b>T{tier}</b>
          <span>{genesisTierMultiplier(tier).toFixed(2)}×</span>
        </span>
      </div>

      <div className="genesis-identity-chips">
        <span className={`ui-pill${registered ? " is-ready" : " is-warning"}`}>
          {registered ? t("registered") : t("notRegistered")}
        </span>
        <span className={`ui-pill${creditActive ? " is-error" : ""}`}>
          {creditActive ? t("creditLocked") : t("transferable")}
        </span>
      </div>

      <dl className="genesis-identity-backing">
        <div>
          <dt>{t("redeemableFor")}</dt>
          <dd>{formatTokenAmountGrouped(vaultPrice, 18, 0)} STATICS</dd>
        </div>
        <div>
          <dt>{t("reserveShare")}</dt>
          <dd>{t("reserveFraction", { supply: maximumSupply.toString() })}</dd>
        </div>
        <div>
          <dt>{t("rewardWeight")}</dt>
          <dd>{registered ? rewardWeight.toString() : "—"}</dd>
        </div>
      </dl>

      {traits.length > 0 && (
        <div className="genesis-identity-traits">
          <p className="dapp-eyebrow">{t("traits")}</p>
          <dl>
            {traits.map((trait) => (
              <div key={trait.label}>
                <dt>{trait.label}</dt>
                <dd>{trait.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </aside>
  );
}
