"use client";

import { useState } from "react";

import { PreviewAction, PreviewAddress, PreviewBanner } from "@/components/preview/DappPreview";

const unavailable = "--";

export function LoansPreview() {
  const [mode, setMode] = useState<"borrow" | "repay" | "extend" | "recover">("borrow");
  const [selectedLoanRow, setSelectedLoanRow] = useState("01");
  return (
    <>
      <PreviewBanner surface="Loan" />
      <section className="remaining-hero" aria-labelledby="preview-loans-title">
        <div>
          <p className="dapp-section-label">Position-owned credit</p>
          <h2 id="preview-loans-title">Position-owned loans</h2>
        </div>
        <dl>
          {["Open loans", "Outstanding principal", "Next maturity"].map((label) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{unavailable}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="remaining-layout">
        <section className="remaining-list" aria-label="Loans">
          <div className="remaining-section-heading">
            <div>
              <p className="dapp-section-label">Loan inventory</p>
              <h3>Independent loans</h3>
            </div>
            <span>{unavailable} total</span>
          </div>
          {["01", "02", "03"].map((row) => (
            <button
              type="button"
              className={`loan-row${selectedLoanRow === row ? " is-selected" : ""}`}
              key={row}
              onClick={() => setSelectedLoanRow(row)}
            >
              <span className="remaining-status">{unavailable}</span>
              <strong>Loan #{unavailable}</strong>
              <small>
                Position #{unavailable} · Basket #{unavailable}
              </small>
              <span>{unavailable}</span>
            </button>
          ))}
        </section>
        <section className="remaining-workspace">
          <div className="remaining-section-heading">
            <div>
              <p className="dapp-section-label">Loan action</p>
              <h3>Loan #{unavailable}</h3>
            </div>
            <span className="remaining-status">{unavailable}</span>
          </div>
          <div className="dollar-tabs loan-tabs" aria-label="Loan action">
            {(["borrow", "repay", "extend", "recover"] as const).map((choice) => (
              <button
                type="button"
                key={choice}
                className={mode === choice ? "active" : undefined}
                onClick={() => setMode(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
          <div className="loan-detail-meta">
            <PreviewAddress label="Position owner" />
            <p>{unavailable}</p>
          </div>
          <dl className="remaining-quote">
            {["Collateral shares", "Origination fee", "Maturity", "Recovery"].map((label) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{unavailable}</dd>
              </div>
            ))}
          </dl>
          <div className="principal-vector">
            <div>
              <span>Principal vector</span>
              <small>{unavailable}</small>
            </div>
            <ul>
              {["01", "02", "03"].map((row) => (
                <li key={row}>
                  <span>{unavailable}</span>
                  <strong>{unavailable}</strong>
                  <small>{unavailable}</small>
                </li>
              ))}
            </ul>
          </div>
          <PreviewAction>
            {mode === "borrow"
              ? "Borrow"
              : mode === "repay"
                ? "Repay"
                : mode === "extend"
                  ? "Extend maturity"
                  : "Recover collateral"}
          </PreviewAction>
        </section>
      </div>
    </>
  );
}

export function LiquidityPreview() {
  const [mode, setMode] = useState<"create" | "stake" | "increase" | "claim" | "unstake">("claim");
  const [selectedLpRow, setSelectedLpRow] = useState("01");
  return (
    <>
      <PreviewBanner surface="Liquidity" />
      <section className="remaining-hero" aria-labelledby="preview-liquidity-title">
        <div>
          <p className="dapp-section-label">Liquidity</p>
          <h2 id="preview-liquidity-title">Pools and your liquidity</h2>
        </div>
        <dl>
          {["Pool fee", "Pools", "Your liquidity"].map((label) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{unavailable}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="pool-catalog">
        <div className="remaining-section-heading">
          <div>
            <p className="dapp-section-label">Pools</p>
            <h3>Pool health</h3>
          </div>
          <span>{unavailable}</span>
        </div>
        <div className="pool-grid">
          {["01", "02"].map((row) => (
            <article key={row}>
              <div>
                <span className="remaining-status">{unavailable}</span>
                <code>{unavailable}</code>
              </div>
              <h4>{unavailable}</h4>
              <p>{unavailable}</p>
              <dl>
                {[
                  "Pool fee",
                  "Trading fees",
                  "Observation",
                  "Manager sync",
                  "Pending protocol liquidity",
                  "Locked protocol liquidity",
                ].map((label) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{unavailable}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </section>
      <section className="fee-allocation">
        <div>
          <p className="dapp-section-label">Effective allocation</p>
          <h3>How trading fees are split</h3>
        </div>
        <dl>
          {["Permanent liquidity", "Your liquidity positions", "Position stakers", "Treasury"].map(
            (label) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{unavailable}</dd>
              </div>
            )
          )}
        </dl>
      </section>
      <div className="remaining-layout liquidity-layout">
        <section className="remaining-list" aria-label="Your liquidity">
          <div className="remaining-section-heading">
            <div>
              <p className="dapp-section-label">Wallet inventory</p>
              <h3>Your liquidity positions</h3>
            </div>
          </div>
          {["01", "02", "03"].map((row) => (
            <button
              type="button"
              className={`lp-position${selectedLpRow === row ? " is-selected" : ""}`}
              key={row}
              onClick={() => setSelectedLpRow(row)}
            >
              <span className="remaining-status">{unavailable}</span>
              <strong>Liquidity position #{unavailable}</strong>
              <small>
                Position #{unavailable} · {unavailable}
              </small>
              <span>{unavailable}</span>
            </button>
          ))}
        </section>
        <section className="remaining-workspace">
          <div className="remaining-section-heading">
            <div>
              <p className="dapp-section-label">Liquidity action</p>
              <h3>Liquidity position #{unavailable}</h3>
            </div>
            <span className="remaining-status">{unavailable}</span>
          </div>
          <div className="dollar-tabs liquidity-tabs" aria-label="Liquidity action">
            {(["create", "stake", "increase", "claim", "unstake"] as const).map((choice) => (
              <button
                type="button"
                key={choice}
                className={mode === choice ? "active" : undefined}
                onClick={() => setMode(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
          <dl className="remaining-quote">
            {[
              "Pool",
              "Range",
              "Eligible liquidity",
              "Pending liquidity",
              "Claimable currency 0",
              "Claimable currency 1",
            ].map((label) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{unavailable}</dd>
              </div>
            ))}
          </dl>
          <PreviewAction>
            {mode === "create"
              ? "Create liquidity position"
              : mode === "stake"
                ? "Stake liquidity position"
                : mode === "increase"
                  ? "Increase liquidity"
                  : mode === "claim"
                    ? "Claim rewards"
                    : "Unstake liquidity position"}
          </PreviewAction>
        </section>
      </div>
    </>
  );
}
