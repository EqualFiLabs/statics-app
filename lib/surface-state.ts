/**
 * Which state a data surface is actually in.
 *
 * Every list page currently collapses "disconnected", "still loading" and
 * "the query failed" into one branch that renders the sample preview, so a
 * first-time visitor sees a dashboard of em dashes and cannot tell which of
 * those three things happened. None of them mean "you have nothing" -- and
 * "you have nothing" is the only one of the four that should read as empty.
 *
 * Deriving the state in one place keeps every surface telling the same story.
 */

export type WalletStatus = "unconfigured" | "loading" | "disconnected" | "error" | "ready";

export type SurfaceStateKind =
  /** No verified deployment is configured. A developer problem, not a user one. */
  | "unconfigured"
  /** No EVM wallet is connected, independent of account authentication. */
  | "disconnected"
  /** Connected to the wrong chain: nothing will load until that is fixed. */
  | "wrong-network"
  /** Data is on its way. */
  | "loading"
  /** The read failed. */
  | "error"
  /** Genuinely nothing here yet -- the only state that is really "empty". */
  | "empty"
  /** There is data to show. */
  | "ready";

export type SurfaceStateInput = Readonly<{
  walletStatus: WalletStatus;
  isTargetChain: boolean;
  /** True while the first read is still outstanding. */
  isLoading: boolean;
  isError: boolean;
  /** True when the read succeeded and returned nothing. */
  isEmpty: boolean;
  /** False before any successful read has landed. */
  hasData: boolean;
}>;

export function deriveSurfaceState(input: SurfaceStateInput): SurfaceStateKind {
  const { walletStatus, isTargetChain, isLoading, isError, isEmpty, hasData } = input;

  if (walletStatus === "unconfigured") return "unconfigured";
  if (walletStatus === "disconnected" || walletStatus === "error") return "disconnected";
  if (walletStatus === "loading") return "loading";
  if (!isTargetChain) return "wrong-network";

  // Keep showing the last good data while a refetch is in flight, and keep
  // showing it if a refetch fails -- replacing a populated screen with a
  // spinner or an error is worse than showing slightly stale numbers.
  if (hasData) return isEmpty ? "empty" : "ready";
  if (isLoading) return "loading";
  if (isError) return "error";

  return isEmpty ? "empty" : "ready";
}

/** True when the surface should render its own content rather than a placeholder. */
export function isSurfaceReady(kind: SurfaceStateKind): boolean {
  return kind === "ready";
}
