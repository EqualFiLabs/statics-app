"use client";

import { formatTokenAmountGrouped } from "@/lib/protocol/ux";

export type VaultSolvencyFigures = Readonly<{
  circulatingGenesis: bigint;
  vaultPrice: bigint;
  grossBacking: bigint;
  outstandingGenesisCredit: bigint;
  requiredBacking: bigint;
  tokenBacking: bigint;
  tokenCustody: bigint;
  reserveETH: bigint;
  nativeCustody: bigint;
}>;

type Invariant = Readonly<{
  label: string;
  left: string;
  right: string;
  holds: boolean;
  surplus: string;
}>;

/**
 * The three invariants `_enforceSolvency` holds, checked against the values the
 * Overview already fetched.
 *
 * `vaultAccounting` returns `tokenCustody` and `nativeCustody` for no purpose
 * other than letting a client verify this, and nothing in the app was reading
 * either. They cost no extra request -- they arrive in the same struct as the
 * numbers the page was already showing.
 *
 * These cannot fail against a healthy node: the Vault reverts any transaction
 * that would break them. A failure here means the client is reading a stale or
 * inconsistent view, which is worth surfacing rather than hiding.
 */
function invariants(figures: VaultSolvencyFigures): readonly Invariant[] {
  const statics = (value: bigint, digits = 0) =>
    `${formatTokenAmountGrouped(value, 18, digits)} STATICS`;
  const eth = (value: bigint) => `${formatTokenAmountGrouped(value, 18, 4)} ETH`;

  return [
    {
      label: "Backing covers every circulating Operators",
      left: statics(figures.tokenBacking),
      right: statics(figures.requiredBacking),
      holds: figures.tokenBacking >= figures.requiredBacking,
      surplus: statics(figures.tokenBacking - figures.requiredBacking, 2),
    },
    {
      label: "The Vault holds that STATICS",
      left: statics(figures.tokenCustody),
      right: statics(figures.tokenBacking),
      holds: figures.tokenCustody >= figures.tokenBacking,
      surplus: statics(figures.tokenCustody - figures.tokenBacking, 2),
    },
    {
      label: "The Vault holds the ETH reserve",
      left: eth(figures.nativeCustody),
      right: eth(figures.reserveETH),
      holds: figures.nativeCustody >= figures.reserveETH,
      surplus: eth(figures.nativeCustody - figures.reserveETH),
    },
  ];
}

export function VaultSolvency({ figures }: { figures: VaultSolvencyFigures | null }) {
  if (!figures) return null;
  const checks = invariants(figures);
  const allHold = checks.every((check) => check.holds);

  return (
    <section className="ui-card overview-panel" aria-label="Vault solvency">
      <div className="overview-panel-head">
        <h3>Solvency</h3>
        <span className={allHold ? "is-accent" : "is-negative"}>
          {allHold ? "All three hold" : "Reading is inconsistent"}
        </span>
      </div>

      <ul className="solvency-checks">
        {checks.map((check) => (
          <li key={check.label} className={check.holds ? undefined : "is-failing"}>
            <span className="solvency-mark" aria-hidden="true">
              {check.holds ? "✓" : "!"}
            </span>
            <span className="solvency-body">
              <strong>{check.label}</strong>
              <span>
                {check.left} ≥ {check.right}
              </span>
            </span>
            <span className="solvency-surplus">{check.holds ? `+${check.surplus}` : "short"}</span>
          </li>
        ))}
      </ul>

      <dl className="solvency-reconcile">
        <div>
          <dt>
            {formatTokenAmountGrouped(figures.circulatingGenesis, 0, 0)} circulating ×{" "}
            {formatTokenAmountGrouped(figures.vaultPrice, 18, 0)}
          </dt>
          <dd>{formatTokenAmountGrouped(figures.grossBacking, 18, 0)}</dd>
        </div>
        <div>
          <dt>less credit drawn against backing</dt>
          <dd>
            {figures.outstandingGenesisCredit > 0n
              ? `−${formatTokenAmountGrouped(figures.outstandingGenesisCredit, 18, 0)}`
              : "0"}
          </dd>
        </div>
        <div className="is-total">
          <dt>Backing required</dt>
          <dd>{formatTokenAmountGrouped(figures.requiredBacking, 18, 0)} STATICS</dd>
        </div>
      </dl>

      <p className="overview-note">
        <b>These are invariants, not targets.</b> The Vault re-checks all three at the end of every
        purchase, redemption, credit and repayment, and reverts the whole transaction if any fails.
      </p>
    </section>
  );
}
