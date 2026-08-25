"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";

import { NftArtwork } from "@/components/wallet/NftArtwork";
import { genesisTierMultiplier } from "@/components/genesis/GenesisTierLadder";
import { resolveNftMetadata } from "@/lib/wallet/nft-image";
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
  const publicClient = usePublicClient({ chainId });

  // The traits ride along with the artwork request the card already makes: the
  // tokenURI document is decoded either way, so this costs no extra RPC.
  const metadata = useQuery({
    queryKey: ["genesis-traits", chainId, collection, id.toString()],
    enabled: Boolean(publicClient),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: ({ signal }) => {
      if (!publicClient) return null;
      return resolveNftMetadata(publicClient, collection, id, signal);
    },
  });

  // The tier is already stated by the badge above, and the registry is a more
  // current source for it than cached metadata.
  const traits = (metadata.data?.traits ?? []).filter(
    (trait) => trait.label.toLowerCase() !== "activation tier"
  );

  return (
    <aside className="genesis-identity ui-card" aria-label={`Genesis #${id} details`}>
      <div className="genesis-identity-art">
        <NftArtwork
          chainId={chainId}
          expandable
          size="lg"
          nft={{
            kind: "collection",
            tokenId: id,
            contract: collection,
            name: `Genesis #${id}`,
            summary: `Tier ${tier}`,
            carries: [],
            blockedReason: creditActive ? "Repay secured credit before transfer." : null,
          }}
        />
      </div>

      <div className="genesis-identity-heading">
        <div>
          <h2 className="ui-section-title">Genesis #{id.toString()}</h2>
          <p className="genesis-identity-sub">1 of {maximumSupply.toString()} · fully backed</p>
        </div>
        <span className="genesis-tier-badge" data-tier={tier}>
          <b>T{tier}</b>
          <span>{genesisTierMultiplier(tier).toFixed(2)}×</span>
        </span>
      </div>

      <div className="genesis-identity-chips">
        <span className={`ui-pill${registered ? " is-ready" : " is-warning"}`}>
          {registered ? "Registered for rewards" : "Not registered"}
        </span>
        <span className={`ui-pill${creditActive ? " is-error" : ""}`}>
          {creditActive ? "Transfer locked · credit active" : "Transferable"}
        </span>
      </div>

      <dl className="genesis-identity-backing">
        <div>
          <dt>Redeemable for</dt>
          <dd>{formatTokenAmountGrouped(vaultPrice, 18, 0)} STATICS</dd>
        </div>
        <div>
          <dt>Reserve share</dt>
          <dd>1 / {maximumSupply.toString()} of ETH reserve</dd>
        </div>
        <div>
          <dt>Reward weight</dt>
          <dd>{registered ? rewardWeight.toString() : "—"}</dd>
        </div>
      </dl>

      {traits.length > 0 && (
        <div className="genesis-identity-traits">
          <p className="dapp-eyebrow">Onchain traits</p>
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
