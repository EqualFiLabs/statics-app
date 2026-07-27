/**
 * The overview's portfolio tiles, defined once.
 *
 * The connected overview and the unavailable-data preview both render these.
 * When each kept its own list they drifted -- the preview was still offering
 * "Basket collateral" and "Pending rewards" after the app had renamed them,
 * so the screen used to review the layout no longer matched the layout.
 *
 * Values are supplied by whichever surface is rendering; only the labels,
 * destinations and calls to action live here.
 */
export type OverviewTile = Readonly<{
  /** Stable key the connected overview uses to attach a value. */
  id: "positions" | "baskets" | "loans" | "rewards";
  label: string;
  href: string;
  action: string;
}>;

export const overviewTiles: readonly OverviewTile[] = [
  { id: "positions", label: "Positions", href: "/app/positions", action: "Review positions" },
  { id: "baskets", label: "Deposited baskets", href: "/app/baskets", action: "Browse baskets" },
  { id: "loans", label: "Loans", href: "/app/loans", action: "Review loans" },
  { id: "rewards", label: "Rewards to claim", href: "/app/rewards", action: "Review rewards" },
];
