"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PreviewAction, PreviewAddress, PreviewBanner } from "@/components/preview/DappPreview";
import {
  previewBasketDraft,
  previewLiquidityPools,
  previewLoanTimeline,
  previewLoans,
  previewLpPositions,
  validatePreviewBasketDraft,
} from "@/lib/preview/remaining-surfaces";

type LoanMode = "borrow" | "repay" | "extend" | "recover";
type LiquidityMode = "create" | "stake" | "increase" | "claim" | "unstake";

const loanModeLabels: Record<LoanMode, string> = {
  borrow: "Borrow principal vector · Preview only",
  repay: "Approve principals or repay · Preview only",
  extend: "Approve extension fees · Preview only",
  recover: "Recover expired tranche · Preview only",
};

export function LoansPreview() {
  const [mode, setMode] = useState<LoanMode>("borrow");
  const [selectedLoanId, setSelectedLoanId] = useState("84");
  const selectedLoan = previewLoans.find((loan) => loan.id === selectedLoanId) ?? previewLoans[0];

  const selectMode = (nextMode: LoanMode) => {
    setMode(nextMode);
    if (nextMode === "recover") setSelectedLoanId("61");
    if (nextMode === "repay" || nextMode === "extend") setSelectedLoanId("84");
  };

  return (
    <>
      <PreviewBanner surface="loan portfolio" />
      <section className="remaining-hero" aria-labelledby="preview-loans-title">
        <div>
          <p className="dapp-section-label">Sample independent tranches</p>
          <h2 id="preview-loans-title">Position-owned loans</h2>
          <p>
            Each borrow creates its own principal vector, locked BasketToken collateral, maturity,
            and recovery schedule.
          </p>
        </div>
        <dl>
          <div>
            <dt>Open tranches</dt>
            <dd>3</dd>
          </div>
          <div>
            <dt>Principal value</dt>
            <dd>$2,434.64 sample</dd>
          </div>
          <div>
            <dt>Recoverable</dt>
            <dd>1 tranche</dd>
          </div>
        </dl>
      </section>

      <div className="remaining-layout">
        <section className="remaining-list" aria-label="Sample loan tranches">
          <div className="remaining-section-heading">
            <div>
              <p className="dapp-section-label">Sample loan ledger</p>
              <h3>Independent obligations</h3>
            </div>
            <span>Protocol time fixture</span>
          </div>
          {previewLoans.map((loan) => {
            const timeline = previewLoanTimeline(loan);
            return (
              <button
                key={loan.id}
                type="button"
                className={`loan-tranche${selectedLoanId === loan.id ? " is-selected" : ""}`}
                onClick={() => setSelectedLoanId(loan.id)}
              >
                <span className={`remaining-status is-${timeline}`}>{timeline}</span>
                <strong>
                  Loan #{loan.id} · Position #{loan.positionId}
                </strong>
                <small>
                  Basket #{loan.basketId} · {loan.basketSymbol}
                </small>
                <span className="loan-time">{loan.maturityLabel}</span>
                <small>{loan.recoveryLabel}</small>
              </button>
            );
          })}
        </section>

        <section className="remaining-workspace">
          <div className="remaining-section-heading">
            <div>
              <p className="dapp-section-label">Sample reviewed action</p>
              <h3>{mode === "borrow" ? "New loan quote" : `Loan #${selectedLoan.id}`}</h3>
            </div>
            {mode !== "borrow" && (
              <span className={`remaining-status is-${previewLoanTimeline(selectedLoan)}`}>
                {previewLoanTimeline(selectedLoan)}
              </span>
            )}
          </div>
          <div className="dollar-tabs remaining-tabs" aria-label="Sample loan action">
            {(["borrow", "repay", "extend", "recover"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={mode === item ? "active" : undefined}
                onClick={() => selectMode(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {mode === "borrow" ? (
            <>
              <div className="remaining-form-grid">
                <label className="basket-field">
                  <span>PositionNFT</span>
                  <select value="1042" disabled>
                    <option value="1042">#1042 · Sample owner</option>
                  </select>
                </label>
                <label className="basket-field">
                  <span>Basket</span>
                  <select value="0" disabled>
                    <option value="0">#0 · sRESERVE</option>
                  </select>
                </label>
                <label className="basket-field">
                  <span>Basket shares in</span>
                  <input value="1,250.00" readOnly />
                  <small>Sample value: $2,540.00</small>
                </label>
                <label className="basket-field">
                  <span>Principal receiver</span>
                  <input value="0xA11c…1042" readOnly />
                  <small>Same sample wallet</small>
                </label>
              </div>
              <dl className="remaining-quote">
                <div>
                  <dt>Origination fee</dt>
                  <dd>2.50 sRESERVE</dd>
                </div>
                <div>
                  <dt>Locked collateral</dt>
                  <dd>1,050.00 sRESERVE</dd>
                </div>
                <div>
                  <dt>Maturity</dt>
                  <dd>30 days after confirmation</dd>
                </div>
                <div>
                  <dt>Recovery</dt>
                  <dd>1 hour after maturity</dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <div className="loan-detail-meta">
                <PreviewAddress label="Sample PositionNFT owner" />
                <p>
                  {selectedLoan.maturityLabel} · {selectedLoan.recoveryLabel}
                </p>
              </div>
              <dl className="remaining-quote">
                <div>
                  <dt>Collateral shares</dt>
                  <dd>
                    {selectedLoan.collateralShares} {selectedLoan.basketSymbol}
                  </dd>
                </div>
                <div>
                  <dt>Origination fee</dt>
                  <dd>{selectedLoan.feeShares} shares</dd>
                </div>
              </dl>
            </>
          )}

          <div className="principal-vector" aria-label="Sample principal vector">
            <div>
              <span>Principal vector</span>
              <small>
                {mode === "extend" ? "Extension fee preview" : "Exact repayment amounts"}
              </small>
            </div>
            <ul>
              {selectedLoan.principals.map((principal) => (
                <li key={principal.symbol}>
                  <span>{principal.symbol}</span>
                  <strong>
                    {mode === "extend"
                      ? `${(Number(principal.amount.replaceAll(",", "")) * 0.001).toFixed(4)} fee`
                      : principal.amount}
                  </strong>
                  <small>{principal.usd} sample value</small>
                </li>
              ))}
            </ul>
          </div>

          {mode === "recover" && (
            <p className="dollar-warning">
              Recovery is permissionless after the one-hour grace period. It is not automatic and
              the caller receives no reward.
            </p>
          )}
          <PreviewAction>{loanModeLabels[mode]}</PreviewAction>
        </section>
      </div>
    </>
  );
}

export function BasketCreatePreview() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const issues = useMemo(() => validatePreviewBasketDraft(previewBasketDraft), []);

  return (
    <>
      <PreviewBanner surface="basket creation" />
      <Link className="basket-back" href="/app/baskets">
        ← Basket catalog
      </Link>
      <section className="remaining-hero" aria-labelledby="preview-create-title">
        <div>
          <p className="dapp-section-label">Sample permissionless configuration</p>
          <h2 id="preview-create-title">Create a static basket</h2>
          <p>
            Define the bundle, fee tiers, lending policy, and exact creation payment before
            reviewing one immutable creation transaction.
          </p>
        </div>
        <span className="remaining-status is-active">Valid sample draft</span>
      </section>

      <ol className="creation-steps" aria-label="Basket creation progress">
        {[
          [1, "Definition"],
          [2, "Economics"],
          [3, "Review"],
        ].map(([number, label]) => (
          <li key={number} className={step === number ? "is-current" : undefined}>
            <button type="button" onClick={() => setStep(number as 1 | 2 | 3)}>
              <span>0{number}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <section className="creation-workspace">
        {step === 1 && (
          <>
            <div className="remaining-form-grid">
              <label className="basket-field">
                <span>Basket name</span>
                <input value={previewBasketDraft.name} readOnly />
              </label>
              <label className="basket-field">
                <span>Symbol</span>
                <input value={previewBasketDraft.symbol} readOnly />
              </label>
            </div>
            <div className="creation-assets">
              <div className="remaining-section-heading">
                <div>
                  <p className="dapp-section-label">Sample bundle</p>
                  <h3>Constituents · {previewBasketDraft.assets.length}/16</h3>
                </div>
                <button type="button" disabled>
                  Add constituent · Preview
                </button>
              </div>
              {previewBasketDraft.assets.map((asset, index) => (
                <article key={asset.address}>
                  <span>0{index + 1}</span>
                  <div>
                    <strong>{asset.symbol}</strong>
                    <code>{`${asset.address.slice(0, 10)}…${asset.address.slice(-4)}`}</code>
                  </div>
                  <label>
                    Bundle amount
                    <input value={asset.amount} readOnly />
                  </label>
                </article>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <div className="creation-economics">
            <section>
              <p className="dapp-section-label">Sample protocol fees</p>
              <h3>Borrowing and flash policy</h3>
              <dl className="remaining-quote">
                <div>
                  <dt>Flash fee</dt>
                  <dd>{previewBasketDraft.flashFeeBps / 100}%</dd>
                </div>
                <div>
                  <dt>Origination fee</dt>
                  <dd>{previewBasketDraft.originationFeeBps / 100}%</dd>
                </div>
                <div>
                  <dt>Extension fee</dt>
                  <dd>{previewBasketDraft.extensionFeeBps / 100}%</dd>
                </div>
                <div>
                  <dt>Maximum LTV</dt>
                  <dd>{previewBasketDraft.ltvBps / 100}%</dd>
                </div>
                <div>
                  <dt>Loan duration</dt>
                  <dd>{previewBasketDraft.loanDurationDays} days</dd>
                </div>
              </dl>
            </section>
            <section>
              <p className="dapp-section-label">Sample tier schedule</p>
              <h3>Mint and redemption fees</h3>
              <div className="creation-tier-grid">
                {[
                  ["Mint tiers", previewBasketDraft.mintFeeTiers],
                  ["Redemption tiers", previewBasketDraft.redemptionFeeTiers],
                ].map(([label, tiers]) => (
                  <article key={String(label)}>
                    <strong>{String(label)}</strong>
                    {(tiers as typeof previewBasketDraft.mintFeeTiers).map((tier) => (
                      <p key={`${tier.threshold}-${tier.feeShares}`}>
                        ≥ {tier.threshold} shares <span>{tier.feeShares} fee shares</span>
                      </p>
                    ))}
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {step === 3 && (
          <div className="creation-review">
            <section>
              <p className="dapp-section-label">Sample validation</p>
              <h3>{issues.length === 0 ? "Configuration passes local review" : "Review issues"}</h3>
              {issues.length === 0 ? (
                <ul>
                  <li>4 unique nonzero constituent addresses</li>
                  <li>Positive bundle amounts and 30-day loan duration</li>
                  <li>75% LTV remains below the 95% protocol maximum</li>
                  <li>Fee tiers and basis-point values are ordered and bounded</li>
                </ul>
              ) : (
                <ul>
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <p className="dapp-section-label">Exact sample payment</p>
              <h3>{previewBasketDraft.creationFee}</h3>
              <p>
                The creation fee is read from the verified diamond immediately before signing and
                must be paid exactly.
              </p>
              <PreviewAddress label="Sample creator" />
            </section>
          </div>
        )}

        <div className="creation-footer">
          <button type="button" disabled={step === 1} onClick={() => setStep((step - 1) as 1 | 2)}>
            Previous
          </button>
          {step < 3 ? (
            <button
              type="button"
              className="creation-next"
              onClick={() => setStep((step + 1) as 2 | 3)}
            >
              Continue to {step === 1 ? "economics" : "review"} →
            </button>
          ) : (
            <PreviewAction>Create basket · Preview only</PreviewAction>
          )}
        </div>
      </section>
    </>
  );
}

const liquidityActionLabels: Record<LiquidityMode, string> = {
  create: "Approve assets or create LP NFT · Preview only",
  stake: "Stake qualifying LP NFT · Preview only",
  increase: "Approve assets or increase liquidity · Preview only",
  claim: "Claim bilateral hook rewards · Preview only",
  unstake: "Unstake and return LP NFT · Preview only",
};

export function LiquidityPreview() {
  const [selectedTokenId, setSelectedTokenId] = useState("4821");
  const [mode, setMode] = useState<LiquidityMode>("claim");
  const selectedPosition =
    previewLpPositions.find((position) => position.tokenId === selectedTokenId) ??
    previewLpPositions[0];

  const chooseMode = (nextMode: LiquidityMode) => {
    setMode(nextMode);
    if (nextMode === "stake" || nextMode === "create") setSelectedTokenId("5012");
    if (nextMode === "increase" || nextMode === "claim" || nextMode === "unstake") {
      setSelectedTokenId("4821");
    }
  };

  return (
    <>
      <PreviewBanner surface="canonical liquidity" />
      <section className="remaining-hero" aria-labelledby="preview-liquidity-title">
        <div>
          <p className="dapp-section-label">Sample canonical v4 state</p>
          <h2 id="preview-liquidity-title">Pools, POL, and user LP NFTs</h2>
          <p>
            Native v4 LP fees remain zero. Bilateral Statics hook fees fund permanent liquidity,
            canonical LPs, PositionNFT stakers, and treasury.
          </p>
        </div>
        <dl>
          <div>
            <dt>Native LP fee</dt>
            <dd>0.00%</dd>
          </div>
          <div>
            <dt>Canonical pools</dt>
            <dd>2 sample</dd>
          </div>
          <div>
            <dt>User LP NFTs</dt>
            <dd>3 sample</dd>
          </div>
        </dl>
      </section>

      <section className="pool-catalog">
        <div className="remaining-section-heading">
          <div>
            <p className="dapp-section-label">Sample chain-reconciled pools</p>
            <h3>Canonical pool health</h3>
          </div>
          <span>Manager installed · Sample</span>
        </div>
        <div className="pool-grid">
          {previewLiquidityPools.map((pool) => (
            <article key={pool.id}>
              <div>
                <span className={`remaining-status is-${pool.status}`}>{pool.status}</span>
                <code>{pool.id}</code>
              </div>
              <h4>{pool.pair}</h4>
              <p>{pool.basket}</p>
              <dl>
                <div>
                  <dt>Native v4 LP fee</dt>
                  <dd>{pool.nativeLpFee}</dd>
                </div>
                <div>
                  <dt>Bilateral hook fees</dt>
                  <dd>{pool.hookFees}</dd>
                </div>
                <div>
                  <dt>Observation</dt>
                  <dd>{pool.observation}</dd>
                </div>
                <div>
                  <dt>Manager sync</dt>
                  <dd>{pool.managerSync}</dd>
                </div>
                <div>
                  <dt>Pending POL</dt>
                  <dd>{pool.pendingPol}</dd>
                </div>
                <div>
                  <dt>Locked POL</dt>
                  <dd>{pool.lockedPol}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="fee-allocation">
        <div>
          <p className="dapp-section-label">Sample effective allocation</p>
          <h3>Four-way bilateral fee split</h3>
          <p>Pool-specific overrides must total exactly 10,000 BPS.</p>
        </div>
        <dl>
          <div>
            <dt>Permanent liquidity</dt>
            <dd>50%</dd>
          </div>
          <div>
            <dt>Canonical LP NFTs</dt>
            <dd>10%</dd>
          </div>
          <div>
            <dt>PositionNFT stakers</dt>
            <dd>30%</dd>
          </div>
          <div>
            <dt>Treasury</dt>
            <dd>10%</dd>
          </div>
        </dl>
      </section>

      <div className="remaining-layout liquidity-layout">
        <section className="remaining-list" aria-label="Sample user LP NFTs">
          <div className="remaining-section-heading">
            <div>
              <p className="dapp-section-label">Sample wallet inventory</p>
              <h3>User-owned PositionManager NFTs</h3>
            </div>
          </div>
          {previewLpPositions.map((position) => (
            <button
              type="button"
              key={position.tokenId}
              className={`lp-position${selectedTokenId === position.tokenId ? " is-selected" : ""}`}
              onClick={() => setSelectedTokenId(position.tokenId)}
            >
              <span className={`remaining-status is-${position.state}`}>{position.state}</span>
              <strong>LP NFT #{position.tokenId}</strong>
              <small>
                PositionNFT #{position.positionId} · {position.pair}
              </small>
              <span>{position.activation}</span>
            </button>
          ))}
        </section>

        <section className="remaining-workspace">
          <div className="remaining-section-heading">
            <div>
              <p className="dapp-section-label">Sample reviewed action</p>
              <h3>
                {mode === "create"
                  ? "Create full-range LP NFT"
                  : `LP NFT #${selectedPosition.tokenId}`}
              </h3>
            </div>
            <span className={`remaining-status is-${selectedPosition.state}`}>
              {selectedPosition.state}
            </span>
          </div>
          <div className="dollar-tabs liquidity-tabs" aria-label="Sample liquidity action">
            {(["create", "stake", "increase", "claim", "unstake"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={mode === item ? "active" : undefined}
                onClick={() => chooseMode(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <dl className="remaining-quote">
            <div>
              <dt>Canonical pool</dt>
              <dd>{selectedPosition.pair}</dd>
            </div>
            <div>
              <dt>Range</dt>
              <dd>Full range · required</dd>
            </div>
            <div>
              <dt>Eligible liquidity</dt>
              <dd>{selectedPosition.eligibleLiquidity}</dd>
            </div>
            <div>
              <dt>Pending liquidity</dt>
              <dd>{selectedPosition.pendingLiquidity}</dd>
            </div>
            <div>
              <dt>Claimable currency 0</dt>
              <dd>{selectedPosition.claimable0}</dd>
            </div>
            <div>
              <dt>Claimable currency 1</dt>
              <dd>{selectedPosition.claimable1}</dd>
            </div>
          </dl>
          <p className="dollar-warning">
            Only nonzero, unsubscribed, full-range NFTs for an active canonical pool qualify.
            Staking and increases activate on the next block; unstaking has no cooldown.
          </p>
          <PreviewAction>{liquidityActionLabels[mode]}</PreviewAction>
        </section>
      </div>

      <section className="pol-boundary">
        <div>
          <p className="dapp-section-label">Protocol-owned boundary</p>
          <h3>Permanent liquidity is not a user LP position</h3>
        </div>
        <p>
          Hook-owned POL remains locked under protocol lifecycle rules. User PositionManager NFTs
          stay separately owned, may be staked for bilateral rewards, and return immediately when
          unstaked.
        </p>
      </section>
    </>
  );
}
