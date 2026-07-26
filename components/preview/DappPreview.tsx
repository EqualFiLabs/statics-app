"use client";

import Link from "next/link";
import { useState } from "react";

const unavailable = "--";

export function PreviewBanner({ surface }: { surface: string }) {
  return (
    <aside className="preview-banner" role="status" data-dapp-preview>
      <div>
        <span>Local Anvil</span>
        <strong>{surface} data unavailable</strong>
      </div>
    </aside>
  );
}

export function PreviewAddress({ label = "Wallet" }: { label?: string }) {
  return (
    <span className="protocol-address">
      <span>{label}</span>
      <code>{unavailable}</code>
    </span>
  );
}

export function PreviewAction({ children }: { children: React.ReactNode }) {
  return (
    <button className="dollar-submit" type="button" disabled>
      {children}
    </button>
  );
}

function UnavailableMetric({ label }: { label: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{unavailable}</strong>
    </article>
  );
}

export function DollarOverviewPreview() {
  return (
    <>
      <PreviewBanner surface="Portfolio" />
      <section className="dollar-overview-card" aria-labelledby="preview-overview-title">
        <div>
          <p className="dapp-section-label">Statics Dollar</p>
          <h2 id="preview-overview-title">{unavailable} Dollar</h2>
          <p>
            Series {unavailable} · {unavailable} active Risk
          </p>
        </div>
        <div className="dollar-overview-health">
          <span>{unavailable}</span>
          <strong>{unavailable}</strong>
          <small>WETH oracle</small>
        </div>
        <Link className="dollar-primary-link" href="/app/dollar">
          Open Dollar
        </Link>
      </section>
      <section className="preview-overview-grid" aria-label="Portfolio summary">
        {[
          ["Positions", "/app/positions", "Review positions"],
          ["Basket collateral", "/app/baskets", "Review baskets"],
          ["Pending rewards", "/app/rewards", "Review rewards"],
          ["Loans", "/app/loans", "Review loans"],
          ["Your liquidity positions", "/app/liquidity", "Review liquidity"],
        ].map(([label, href, action]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{unavailable}</strong>
            <small>{unavailable}</small>
            <Link href={href}>{action} →</Link>
          </article>
        ))}
      </section>
    </>
  );
}

export function DollarPagePreview() {
  const [mode, setMode] = useState<"deposit" | "recombine">("deposit");
  const [asset, setAsset] = useState<"ETH" | "WETH">("ETH");
  return (
    <>
      <PreviewBanner surface="Dollar" />
      <section className="dollar-metrics" aria-label="Dollar balances">
        <UnavailableMetric label="Dollar balance" />
        <UnavailableMetric label="Risk series" />
        <UnavailableMetric label="WETH balance" />
        <UnavailableMetric label="WETH oracle" />
      </section>
      <section className="dollar-workspace">
        <div className="dollar-action-card">
          <div className="dollar-tabs" aria-label="Dollar action">
            <button
              type="button"
              className={mode === "deposit" ? "active" : undefined}
              onClick={() => setMode("deposit")}
            >
              Deposit
            </button>
            <button
              type="button"
              className={mode === "recombine" ? "active" : undefined}
              onClick={() => setMode("recombine")}
            >
              Recombine
            </button>
          </div>
          <fieldset className="dollar-asset-choice">
            <legend>Collateral output</legend>
            {(["ETH", "WETH"] as const).map((choice) => (
              <button
                type="button"
                key={choice}
                className={asset === choice ? "active" : undefined}
                onClick={() => setAsset(choice)}
              >
                {choice}
              </button>
            ))}
          </fieldset>
          <div className="dollar-field">
            <label htmlFor="preview-dollar-amount">
              {mode === "deposit" ? `${asset} collateral` : "Dollar amount"}
            </label>
            <div>
              <input id="preview-dollar-amount" value="" placeholder={unavailable} readOnly />
              <button type="button" disabled>
                Max
              </button>
            </div>
            <small>
              Wallet balance · {unavailable} {asset}
            </small>
          </div>
          <div className="dollar-quote">
            <span>Quote</span>
            <strong>{unavailable}</strong>
            <small>{unavailable}</small>
          </div>
          <PreviewAction>{mode === "deposit" ? "Deposit" : "Recombine"}</PreviewAction>
        </div>
        <aside className="dollar-protocol-card">
          <p className="dapp-section-label">Protocol state</p>
          <dl>
            {["Profile", "Global health", "Borrow limit", "Status"].map((label) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{unavailable}</dd>
              </div>
            ))}
          </dl>
          <PreviewAddress />
        </aside>
      </section>
    </>
  );
}

const placeholderRouteIds = ["0", "1"] as const;

export function BasketListPreview() {
  return (
    <>
      <PreviewBanner surface="Basket catalog" />
      <section className="basket-catalog" aria-labelledby="preview-basket-catalog-title">
        <div className="basket-section-heading">
          <div>
            <p className="dapp-section-label">Basket catalog</p>
            <h2 id="preview-basket-catalog-title">Statics baskets</h2>
          </div>
          <div className="basket-section-actions">
            <span>{unavailable} discovered</span>
            <Link href="/app/create">Create basket →</Link>
          </div>
        </div>
        <div className="basket-grid">
          {placeholderRouteIds.map((routeId) => (
            <Link className="basket-card" href={`/app/baskets/${routeId}`} key={routeId}>
              <div>
                <span className="basket-status">{unavailable}</span>
                <span>#{unavailable}</span>
              </div>
              <h3>{unavailable}</h3>
              <p>{unavailable}</p>
              <dl>
                {["Constituents", "Total supply", "Your balance"].map((label) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{unavailable}</dd>
                  </div>
                ))}
              </dl>
              <span className="basket-card-link">Inspect basket →</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

export function BasketDetailPreview({ basketId }: { basketId: bigint }) {
  const [mode, setMode] = useState<"mint" | "redeem">("mint");
  return (
    <>
      <PreviewBanner surface="Basket" />
      <Link className="basket-back" href="/app/baskets">
        ← All baskets
      </Link>
      <section className="basket-hero">
        <div>
          <p className="dapp-section-label">Basket #{basketId.toString()}</p>
          <h2>{unavailable}</h2>
          <p>{unavailable}</p>
        </div>
        <dl>
          {["Total supply", "Your balance", "Vault value"].map((label) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{unavailable}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="basket-detail-grid">
        <section className="basket-composition">
          <p className="dapp-section-label">Composition</p>
          <ol>
            {["01", "02", "03", "04"].map((number) => (
              <li key={number}>
                <span>{number}</span>
                <div>
                  <strong>{unavailable}</strong>
                  <small>{unavailable} target bundle</small>
                </div>
                <div>
                  <strong>{unavailable}</strong>
                  <small>Vault balance</small>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="basket-action-card">
          <p className="dapp-section-label">Basket action</p>
          <div className="dollar-tabs">
            {(["mint", "redeem"] as const).map((choice) => (
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
          <label className="basket-field">
            <span>Basket shares</span>
            <input value="" placeholder={unavailable} readOnly />
            <small>Balance: {unavailable}</small>
          </label>
          <div className="basket-quote">
            <span>Bounded quote</span>
            <strong>{unavailable}</strong>
            <small>{unavailable}</small>
          </div>
          <PreviewAction>{mode === "mint" ? "Mint basket" : "Redeem basket"}</PreviewAction>
        </section>
      </div>
      <section className="basket-parameters">
        <p className="dapp-section-label">Risk parameters</p>
        <dl>
          {["LTV", "Loan duration", "Mint fee", "Flash fee"].map((label) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{unavailable}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

export function PositionListPreview() {
  return (
    <>
      <PreviewBanner surface="Your positions" />
      <section className="position-catalog" aria-labelledby="preview-position-title">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">Your positions</p>
            <h2 id="preview-position-title">Your positions</h2>
          </div>
          <PreviewAction>Create position</PreviewAction>
        </div>
        <div className="position-grid">
          {placeholderRouteIds.map((routeId) => (
            <article className="position-card" key={routeId}>
              <div>
                <strong>Position #{unavailable}</strong>
                <span>{unavailable} active legs</span>
              </div>
              <PreviewAddress label="Owner" />
              <dl>
                {["Basket collateral", "Global stake", "Reward selections"].map((label) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{unavailable}</dd>
                  </div>
                ))}
              </dl>
              <Link className="position-card-link" href={`/app/positions/${routeId}`}>
                Manage position →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function PositionDetailPreview({ positionId }: { positionId: bigint }) {
  const [collateralMode, setCollateralMode] = useState("deposit");
  const [stakeMode, setStakeMode] = useState("stake");
  return (
    <>
      <PreviewBanner surface="Position" />
      <Link className="basket-back" href="/app/positions">
        ← All positions
      </Link>
      <section className="position-hero">
        <div>
          <p className="dapp-section-label">Position</p>
          <h2>Position #{positionId.toString()}</h2>
          <PreviewAddress label="Owner" />
        </div>
        <dl>
          {["Active legs", "Basket legs", "Reward assets"].map((label) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{unavailable}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="position-detail-grid">
        <section className="position-panel">
          <p className="dapp-section-label">Basket collateral</p>
          <h3>Manage collateral legs</h3>
          <div className="dollar-tabs preview-four-tabs" aria-label="Collateral action">
            {["deposit", "mint", "withdraw", "redeem"].map((choice) => (
              <button
                type="button"
                key={choice}
                className={collateralMode === choice ? "active" : undefined}
                onClick={() => setCollateralMode(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
          <label className="basket-field">
            <span>Basket</span>
            <select disabled>
              <option>{unavailable}</option>
            </select>
          </label>
          <label className="basket-field">
            <span>Basket shares</span>
            <input value="" placeholder={unavailable} readOnly />
            <small>
              Wallet: {unavailable} · Position unlocked: {unavailable}
            </small>
          </label>
          <PreviewAction>{collateralMode} collateral</PreviewAction>
        </section>
        <section className="position-panel">
          <p className="dapp-section-label">Global staking</p>
          <h3>Stake WETH</h3>
          <div className="dollar-tabs" aria-label="Staking action">
            {["stake", "unstake"].map((choice) => (
              <button
                type="button"
                key={choice}
                className={stakeMode === choice ? "active" : undefined}
                onClick={() => setStakeMode(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
          <dl className="position-metrics">
            <div>
              <dt>Wallet balance</dt>
              <dd>{unavailable}</dd>
            </div>
            <div>
              <dt>Position stake</dt>
              <dd>{unavailable}</dd>
            </div>
          </dl>
          <label className="basket-field">
            <span>WETH amount</span>
            <input value="" placeholder={unavailable} readOnly />
          </label>
          <PreviewAction>{stakeMode} WETH</PreviewAction>
        </section>
      </div>
      <section className="position-panel position-rewards">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">Position rewards</p>
            <h3>Selected fee assets</h3>
          </div>
          <span>{unavailable} selected</span>
        </div>
        <div className="reward-grid">
          {["01", "02", "03", "04"].map((row) => (
            <article key={row}>
              <div>
                <strong>{unavailable}</strong>
                <span>{unavailable}</span>
              </div>
              <p>Pending: {unavailable}</p>
              <button type="button" disabled>
                Select reward
              </button>
            </article>
          ))}
        </div>
        <PreviewAction>Claim selected rewards</PreviewAction>
      </section>
      <section className="position-attached-grid" aria-label="Attached protocol legs">
        <article>
          <p className="dapp-section-label">Loan legs</p>
          <h3>{unavailable}</h3>
          <p>{unavailable}</p>
          <Link href="/app/loans">Review loan tranches →</Link>
        </article>
        <article>
          <p className="dapp-section-label">Liquidity legs</p>
          <h3>{unavailable}</h3>
          <p>{unavailable}</p>
          <Link href="/app/liquidity">Review LP positions →</Link>
        </article>
      </section>
      <section className="position-close">
        <div>
          <p className="dapp-section-label">Terminal action</p>
          <h3>Close position</h3>
        </div>
        <button type="button" disabled>
          Close position
        </button>
      </section>
    </>
  );
}

export function RewardsPreview() {
  return (
    <>
      <PreviewBanner surface="Rewards" />
      <div className="rewards-page">
        <section className="position-panel">
          <div className="position-section-heading">
            <div>
              <p className="dapp-section-label">Atomic position creation</p>
              <h2>Create and stake</h2>
            </div>
            <span>Total staked: {unavailable}</span>
          </div>
          <label className="basket-field">
            <span>Staking amount</span>
            <input value="" placeholder={unavailable} readOnly />
            <small>Wallet balance: {unavailable}</small>
          </label>
          <fieldset className="reward-selector" disabled>
            <legend>Initial reward selections · {unavailable}</legend>
            {["01", "02", "03", "04"].map((row) => (
              <label key={row}>
                <input type="checkbox" />
                <span>
                  <strong>{unavailable}</strong>
                  {unavailable}
                </span>
              </label>
            ))}
          </fieldset>
          <PreviewAction>Approve or create staking position</PreviewAction>
        </section>
        <section className="position-panel">
          <div className="position-section-heading">
            <div>
              <p className="dapp-section-label">Wallet-owned positions</p>
              <h2>Selected rewards</h2>
            </div>
            <span>Multi-asset claims</span>
          </div>
          <div className="reward-position-list">
            {placeholderRouteIds.map((routeId) => (
              <article key={routeId}>
                <div>
                  <h3>Position #{unavailable}</h3>
                  <span>{unavailable} staked</span>
                </div>
                <ul>
                  {["01", "02"].map((reward) => (
                    <li key={reward}>
                      <label>
                        <input type="checkbox" disabled />
                        <span>{unavailable}</span>
                      </label>
                      <strong>{unavailable} pending</strong>
                    </li>
                  ))}
                </ul>
                <PreviewAction>Claim selected rewards</PreviewAction>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export function ActivityPreview() {
  return (
    <>
      <PreviewBanner surface="Activity" />
      <section className="activity-panel" aria-labelledby="activity-title">
        <div>
          <p className="dapp-section-label">Wallet and network scoped</p>
          <h2 id="activity-title">Protocol activity</h2>
        </div>
        <ol>
          {["01", "02", "03"].map((row) => (
            <li key={row}>
              <div>
                <strong>{unavailable}</strong>
                <span>{unavailable}</span>
              </div>
              <div>
                <strong className="activity-status">{unavailable}</strong>
                <time>{unavailable}</time>
              </div>
              <code>{unavailable}</code>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export function WalletSettingsPreview() {
  return (
    <>
      <PreviewBanner surface="Wallet" />
      <section className="dapp-settings" aria-labelledby="wallet-settings-title">
        <div className="dapp-settings-heading">
          <p className="dapp-section-label">Account</p>
          <h2 id="wallet-settings-title">Wallet settings</h2>
        </div>
        <dl className="dapp-wallet-details">
          {["Status", "Wallet type", "Address", "Target network"].map((label) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{unavailable}</dd>
            </div>
          ))}
        </dl>
        <div className="dapp-settings-actions">
          <button type="button" disabled>
            Copy full address
          </button>
          <button type="button" disabled>
            View on explorer
          </button>
        </div>
        <button className="dapp-logout" type="button" disabled>
          Sign out of Statics
        </button>
      </section>
    </>
  );
}
