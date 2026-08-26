"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { NftArtwork } from "@/components/wallet/NftArtwork";

export type GenesisCarouselItem = Readonly<{
  id: bigint;
  tier: number;
  registered: boolean;
  hasPendingRewards: boolean;
  creditActive: boolean;
}>;

type Filter = "all" | "unregistered" | "pending" | "credit";

const FILTERS: readonly Readonly<{ key: Filter; label: string; flag: string | null }>[] = [
  { key: "all", label: "All", flag: null },
  { key: "unregistered", label: "Not registered", flag: "unregistered" },
  { key: "pending", label: "Rewards pending", flag: "pending" },
  { key: "credit", label: "Credit active", flag: "credit" },
];

function matches(item: GenesisCarouselItem, filter: Filter): boolean {
  if (filter === "unregistered") return !item.registered;
  if (filter === "pending") return item.hasPendingRewards;
  if (filter === "credit") return item.creditActive;
  return true;
}

/**
 * The wallet's Operators NFTs, as a paged rail rather than a wrapping chip row.
 *
 * A wrapping row is fine at three NFTs and unusable at thirty: it grows a new
 * line for every few tokens, pushes the NFT you are managing below the fold,
 * and reflows whenever a badge appears or clears. This rail is fixed at one
 * line and pages horizontally instead.
 *
 * Past `GRID_THRESHOLD` the rail stops being the right tool -- paging six at a
 * time through sixty is worse than the wrap it replaced -- so a grid view with
 * status filters takes over.
 */
const GRID_THRESHOLD = 12;

export function GenesisCarousel({
  items,
  selectedId,
  onSelect,
  chainId,
  collection,
}: Readonly<{
  items: readonly GenesisCarouselItem[];
  selectedId: bigint | null;
  onSelect: (id: bigint) => void;
  chainId: number;
  collection: `0x${string}`;
}>) {
  const railRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"carousel" | "grid">("carousel");
  const [filter, setFilter] = useState<Filter>("all");
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const visible = view === "grid" ? items.filter((item) => matches(item, filter)) : items;

  const syncOverflow = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const scrollable = rail.scrollWidth > rail.clientWidth + 1;
    setOverflow({
      start: scrollable && rail.scrollLeft > 1,
      end: scrollable && rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    syncOverflow();
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(syncOverflow);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [syncOverflow, visible.length, view]);

  // Selecting through the keyboard, or from anywhere else on the page, has to
  // bring the card back into view or the selection becomes invisible.
  useEffect(() => {
    if (view === "grid") return;
    const rail = railRef.current;
    const card = rail?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!rail || !card) return;
    const cardBox = card.getBoundingClientRect();
    const railBox = rail.getBoundingClientRect();
    if (cardBox.left < railBox.left) {
      rail.scrollLeft -= railBox.left - cardBox.left + 12;
    } else if (cardBox.right > railBox.right) {
      rail.scrollLeft += cardBox.right - railBox.right + 12;
    }
  }, [selectedId, view]);

  const page = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>(".genesis-carousel-card");
    const step = card ? card.getBoundingClientRect().width + 12 : rail.clientWidth * 0.8;
    // Advance by a whole page less one card, so the card at the edge stays
    // visible as an anchor rather than jumping out of sight.
    const perPage = Math.max(1, Math.floor(rail.clientWidth / step) - 1);
    rail.scrollLeft += direction * step * perPage;
  };

  const move = (from: bigint, delta: 1 | -1) => {
    const order = visible;
    const index = order.findIndex((item) => item.id === from);
    const next = order[index + delta];
    if (next) onSelect(next.id);
  };

  const showGridToggle = items.length > GRID_THRESHOLD;
  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <section className="genesis-carousel" aria-label="Your Operators NFTs">
      <div className="genesis-carousel-head">
        <h2 className="ui-section-title">Your Operators</h2>
        <span className="genesis-carousel-count">
          {items.length} held{selected ? ` · #${selected.id} selected` : ""}
        </span>
        <div className="genesis-carousel-controls">
          {showGridToggle && (
            <button
              className="ui-button ui-button--ghost ui-button--sm"
              type="button"
              onClick={() => {
                setView(view === "carousel" ? "grid" : "carousel");
                setFilter("all");
              }}
            >
              {view === "carousel" ? "View all" : "Back to carousel"}
            </button>
          )}
          {view === "carousel" && (overflow.start || overflow.end) && (
            <div className="genesis-carousel-pager">
              <button
                type="button"
                onClick={() => page(-1)}
                disabled={!overflow.start}
                aria-label="Previous Operators NFTs"
              >
                <span aria-hidden="true">‹</span>
              </button>
              <button
                type="button"
                onClick={() => page(1)}
                disabled={!overflow.end}
                aria-label="More Operators NFTs"
              >
                <span aria-hidden="true">›</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {view === "grid" && (
        <div className="genesis-carousel-filters">
          {FILTERS.map((entry) => {
            const count =
              entry.key === "all"
                ? items.length
                : items.filter((item) => matches(item, entry.key)).length;
            return (
              <button
                key={entry.key}
                className="genesis-carousel-filter"
                type="button"
                aria-pressed={filter === entry.key}
                onClick={() => setFilter(entry.key)}
              >
                {entry.flag && <i className={`genesis-flag is-${entry.flag}`} aria-hidden="true" />}
                {entry.label} {count}
              </button>
            );
          })}
        </div>
      )}

      <div
        className={`genesis-carousel-rail${view === "grid" ? " is-grid" : ""}`}
        data-overflow-end={overflow.end && view === "carousel" ? "true" : undefined}
        ref={railRef}
        onScroll={syncOverflow}
        role="tablist"
        aria-label="Select a Operator NFT"
      >
        {visible.map((item) => {
          const isSelected = item.id === selectedId;
          return (
            <button
              key={item.id.toString()}
              className="genesis-carousel-card"
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  move(item.id, 1);
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  move(item.id, -1);
                } else if (event.key === "Home" && visible[0]) {
                  event.preventDefault();
                  onSelect(visible[0].id);
                } else if (event.key === "End" && visible.length) {
                  event.preventDefault();
                  onSelect(visible[visible.length - 1].id);
                }
              }}
            >
              <NftArtwork
                chainId={chainId}
                size="lg"
                nft={{
                  kind: "collection",
                  tokenId: item.id,
                  contract: collection,
                  name: `Genesis #${item.id}`,
                  summary: `Tier ${item.tier}`,
                  carries: [],
                  blockedReason: null,
                }}
              />
              <span className="genesis-carousel-id">
                Genesis #{item.id.toString()}
                <b>T{item.tier}</b>
              </span>
              <span className="genesis-carousel-flags">
                {!item.registered && (
                  <i className="genesis-flag is-unregistered" title="Not registered" />
                )}
                {item.hasPendingRewards && (
                  <i className="genesis-flag is-pending" title="Rewards pending" />
                )}
                {item.creditActive && (
                  <i className="genesis-flag is-credit" title="Credit active" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {view === "carousel" && (
        <p className="genesis-carousel-legend">
          <span>
            <i className="genesis-flag is-unregistered" aria-hidden="true" /> Not registered
          </span>
          <span>
            <i className="genesis-flag is-pending" aria-hidden="true" /> Rewards pending
          </span>
          <span>
            <i className="genesis-flag is-credit" aria-hidden="true" /> Credit active — transfer
            locked
          </span>
        </p>
      )}
    </section>
  );
}
