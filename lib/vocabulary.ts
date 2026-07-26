/**
 * Consumer vocabulary for the DApp.
 *
 * The protocol's own names are precise but they describe the implementation,
 * not the thing a person owns. `PositionNFT` says how the position is stored;
 * `canonical v4 liquidity` says which contract holds it. Neither helps someone
 * decide what to tap.
 *
 * The rule this file follows:
 *
 *   - translate IMPLEMENTATION vocabulary  (PositionNFT, hook, canonical v4,
 *     EIP-2535, event-discovered, tranche)
 *   - keep PRODUCT vocabulary              (Dollar, Basket, Position)
 *   - keep ordinary FINANCE vocabulary     (collateral, redeem, rewards, yield)
 *
 * The goal is not to dumb the app down. Someone using a finance product can
 * read "collateral". Nobody outside the team can read "event-discovered ·
 * ownership-reconciled".
 *
 * Every entry keeps its `protocol` name so power users, docs and support can
 * still map a screen back to the contract it talks to -- see the Term
 * component, which surfaces it on hover.
 */

export type GlossaryEntry = {
  /** What a person reads in the UI. */
  label: string;
  /** Plural form, when it is not just `label + "s"`. */
  plural?: string;
  /** One sentence, no jargon, explaining what this is. */
  plain: string;
  /** The protocol's own term, kept for docs, support and power users. */
  protocol: string;
};

export const glossary = {
  position: {
    label: "Position",
    plain: "Everything you hold in Statics, bundled into one transferable item.",
    protocol: "PositionNFT",
  },
  basket: {
    label: "Basket",
    plain: "A fixed bundle of assets you can buy or sell as a single unit.",
    protocol: "Static basket",
  },
  dollar: {
    label: "Dollar",
    plain: "Statics' own dollar, backed by assets you deposit.",
    protocol: "Statics Dollar ($SD)",
  },
  riskShares: {
    label: "Risk shares",
    plural: "Risk shares",
    plain: "The variable half of a deposit: it absorbs price moves so the Dollar stays stable.",
    protocol: "Risk shares",
  },
  collateral: {
    label: "Collateral",
    plural: "Collateral",
    plain: "Assets you lock up to back a Dollar balance or a loan.",
    protocol: "Collateral",
  },
  loan: {
    label: "Loan",
    plain: "Money borrowed against collateral you have locked, repayable on its own schedule.",
    protocol: "Loan tranche",
  },
  liquidity: {
    label: "Liquidity",
    plural: "Liquidity",
    plain: "Assets you supply so other people can trade, earning you a share of the fees.",
    protocol: "Canonical Uniswap v4 liquidity",
  },
  liquidityPosition: {
    label: "Liquidity position",
    plain: "Your individual share of a trading pool.",
    protocol: "LP NFT",
  },
  tradingFees: {
    label: "Trading fees",
    plural: "Trading fees",
    plain: "The cut taken on each trade in a pool, shared out to the people who supplied it.",
    protocol: "Bilateral hook fees",
  },
  protocolLiquidity: {
    label: "Protocol-owned liquidity",
    plural: "Protocol-owned liquidity",
    plain: "Liquidity the protocol holds permanently, rather than any individual person.",
    protocol: "Hook-owned permanent liquidity",
  },
  priceFeed: {
    label: "Price feed",
    plain: "The live price the protocol uses to value your assets.",
    protocol: "Oracle",
  },
  borrowLimit: {
    label: "Borrow limit",
    plain: "The most that can be borrowed against the collateral backing this profile.",
    protocol: "Debt ceiling",
  },
  health: {
    label: "Health",
    plural: "Health",
    plain: "How well covered your position is. Higher is safer.",
    protocol: "Solvency",
  },
  rewards: {
    label: "Rewards",
    plural: "Rewards",
    plain: "Fees you have earned and can claim.",
    protocol: "Indexed rewards",
  },
  staking: {
    label: "Staking",
    plural: "Staking",
    plain: "Locking a position so it earns a share of protocol fees.",
    protocol: "Staking",
  },
  cooldown: {
    label: "Cooldown",
    plain: "A waiting period after you unstake, before funds are released.",
    protocol: "Unstaking cooldown",
  },
  openToAnyone: {
    label: "Open to anyone",
    plural: "Open to anyone",
    plain: "No approval or gatekeeper. Anyone can do this.",
    protocol: "Permissionless",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type TermKey = keyof typeof glossary;

/** The consumer-facing label for a term. */
export function term(key: TermKey): string {
  return glossary[key].label;
}

/**
 * The plural consumer-facing label for a term.
 *
 * Widened to GlossaryEntry first: `as const` narrows each entry to its own
 * literal type, and entries without a `plural` do not carry the key at all.
 */
export function termPlural(key: TermKey): string {
  const entry: GlossaryEntry = glossary[key];
  return entry.plural ?? `${entry.label}s`;
}

/** The one-sentence explanation, for tooltips and empty states. */
export function explain(key: TermKey): string {
  return glossary[key].plain;
}

/**
 * The protocol's own name, for docs links, support threads and the
 * power-user affordance on Term.
 */
export function protocolTerm(key: TermKey): string {
  return glossary[key].protocol;
}
