"use client";

import Link from "next/link";
import { useState } from "react";

const sampleWallet = "0xA11cE00000000000000000000000000000001042";

function PreviewBanner({ surface }: { surface: string }) {
  return (
    <aside className="preview-banner" role="status" data-dapp-preview>
      <div>
        <span>Local design preview</span>
        <strong>Sample {surface} data</strong>
      </div>
      <p>
        No wallet, RPC, or deployment is connected. Values are deterministic fixtures and every
        value-moving control is disabled.
      </p>
    </aside>
  );
}

function PreviewAddress({ label = "Sample wallet" }: { label?: string }) {
  return (
    <span className="protocol-address">
      <span>{label}</span>
      <code title={sampleWallet}>0xA11c…1042</code>
      <span className="preview-data-tag">Sample</span>
    </span>
  );
}

function PreviewAction({ children }: { children: React.ReactNode }) {
  return (
    <button className="dollar-submit" type="button" disabled>
      {children}
    </button>
  );
}

export function DollarOverviewPreview() {
  return (
    <>
      <PreviewBanner surface="portfolio" />
      <section className="dollar-overview-card" aria-labelledby="preview-overview-title">
        <div>
          <p className="dapp-section-label">Statics Dollar · Sample</p>
          <h2 id="preview-overview-title">12,480.52 Dollar</h2>
          <p>Series 7 · 3,218.90 active Risk</p>
        </div>
        <div className="dollar-overview-health">
          <span>Healthy</span>
          <strong>$3,842.16</strong>
          <small>Sample WETH oracle</small>
        </div>
        <Link className="dollar-primary-link" href="/app/dollar">
          Open Dollar
        </Link>
      </section>
      <section className="preview-overview-grid" aria-label="Sample portfolio summary">
        <article>
          <span>PositionNFTs</span>
          <strong>3</strong>
          <small>7 active protocol legs</small>
          <Link href="/app/positions">Review positions →</Link>
        </article>
        <article>
          <span>Basket collateral</span>
          <strong>$18,420</strong>
          <small>Across 2 baskets</small>
          <Link href="/app/baskets">Review baskets →</Link>
        </article>
        <article>
          <span>Pending rewards</span>
          <strong>$186.42</strong>
          <small>4 selected assets</small>
          <Link href="/app/rewards">Review rewards →</Link>
        </article>
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
      <section className="dollar-metrics" aria-label="Sample Dollar balances">
        <article>
          <span>Dollar balance</span>
          <strong>12,480.52</strong>
        </article>
        <article>
          <span>Risk series 7</span>
          <strong>3,218.90</strong>
        </article>
        <article>
          <span>WETH balance</span>
          <strong>8.425</strong>
        </article>
        <article>
          <span>WETH oracle</span>
          <strong>$3,842.16</strong>
        </article>
      </section>
      <section className="dollar-workspace">
        <div className="dollar-action-card">
          <div className="dollar-tabs" aria-label="Sample Dollar action">
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
            <legend>Sample collateral output</legend>
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
              <input id="preview-dollar-amount" value="2.50" readOnly />
              <button type="button">Max</button>
            </div>
            <small>Sample wallet balance · 8.425 {asset}</small>
          </div>
          <div className="dollar-quote">
            <span>Sample authoritative preview</span>
            <strong>
              {mode === "deposit"
                ? "Receive 9,557.84 Dollar + 644.22 Risk"
                : `Receive 2.43 ${asset} after recombination`}
            </strong>
            <small>0.50% bound · Series 7 · refreshed 3s ago</small>
          </div>
          <PreviewAction>Preview only · connect local deployment</PreviewAction>
        </div>
        <aside className="dollar-protocol-card">
          <p className="dapp-section-label">Sample protocol state</p>
          <dl>
            <div>
              <dt>Profile</dt>
              <dd>WETH · Active</dd>
            </div>
            <div>
              <dt>Global health</dt>
              <dd>Healthy</dd>
            </div>
            <div>
              <dt>Debt ceiling</dt>
              <dd>38.6% used</dd>
            </div>
            <div>
              <dt>Exit state</dt>
              <dd>Available</dd>
            </div>
          </dl>
          <p className="dollar-warning">
            Sample state only. Quotes and approvals will come from verified contracts when a local
            deployment is connected.
          </p>
          <PreviewAddress />
        </aside>
      </section>
    </>
  );
}

const sampleBaskets = [
  {
    id: "0",
    name: "Dollar Reserve",
    symbol: "sRESERVE",
    constituents: "4",
    supply: "24,680.00",
    balance: "1,250.00",
  },
  {
    id: "1",
    name: "Blue Chip Index",
    symbol: "sBLUE",
    constituents: "6",
    supply: "8,412.75",
    balance: "428.50",
  },
] as const;

export function BasketListPreview() {
  return (
    <>
      <PreviewBanner surface="basket catalog" />
      <section className="basket-catalog" aria-labelledby="preview-basket-catalog-title">
        <div className="basket-section-heading">
          <div>
            <p className="dapp-section-label">Sample event-discovered catalog</p>
            <h2 id="preview-basket-catalog-title">Statics baskets</h2>
          </div>
          <span>2 sample baskets</span>
        </div>
        <div className="basket-grid">
          {sampleBaskets.map((basket) => (
            <Link className="basket-card" href={`/app/baskets/${basket.id}`} key={basket.id}>
              <div>
                <span className="basket-status is-0">Active</span>
                <span>#{basket.id}</span>
              </div>
              <h3>{basket.name}</h3>
              <p>{basket.symbol}</p>
              <dl>
                <div>
                  <dt>Constituents</dt>
                  <dd>{basket.constituents}</dd>
                </div>
                <div>
                  <dt>Total supply</dt>
                  <dd>{basket.supply}</dd>
                </div>
                <div>
                  <dt>Your balance</dt>
                  <dd>{basket.balance}</dd>
                </div>
              </dl>
              <span className="basket-card-link">Inspect sample basket →</span>
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
      <PreviewBanner surface="basket detail" />
      <Link className="basket-back" href="/app/baskets">
        ← All baskets
      </Link>
      <section className="basket-hero">
        <div>
          <p className="dapp-section-label">Sample basket #{basketId.toString()}</p>
          <h2>Dollar Reserve</h2>
          <p>sRESERVE · Active</p>
        </div>
        <dl>
          <div>
            <dt>Total supply</dt>
            <dd>24,680.00</dd>
          </div>
          <div>
            <dt>Your balance</dt>
            <dd>1,250.00</dd>
          </div>
          <div>
            <dt>Vault value</dt>
            <dd>$1.84M</dd>
          </div>
        </dl>
      </section>
      <div className="basket-detail-grid">
        <section className="basket-composition">
          <p className="dapp-section-label">Sample composition</p>
          <ol>
            {[
              ["01", "Statics Dollar", "50.00%", "12,340.00"],
              ["02", "Wrapped Ether", "25.00%", "4.0125"],
              ["03", "Wrapped Bitcoin", "15.00%", "0.0842"],
              ["04", "USDC", "10.00%", "18,420.00"],
            ].map(([number, name, weight, amount]) => (
              <li key={number}>
                <span>{number}</span>
                <div>
                  <strong>{name}</strong>
                  <small>{weight} target bundle</small>
                </div>
                <div>
                  <strong>{amount}</strong>
                  <small>Sample vault balance</small>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="basket-action-card">
          <p className="dapp-section-label">Sample basket action</p>
          <div className="dollar-tabs">
            <button
              type="button"
              className={mode === "mint" ? "active" : undefined}
              onClick={() => setMode("mint")}
            >
              Mint
            </button>
            <button
              type="button"
              className={mode === "redeem" ? "active" : undefined}
              onClick={() => setMode("redeem")}
            >
              Redeem
            </button>
          </div>
          <label className="basket-field">
            <span>sRESERVE shares</span>
            <input value="100.00" readOnly />
            <small>Sample balance: 1,250.00 sRESERVE</small>
          </label>
          <div className="basket-quote">
            <span>Sample bounded quote</span>
            <strong>{mode === "mint" ? "4 constituent inputs" : "4 constituent outputs"}</strong>
            <small>0.50% slippage tolerance</small>
          </div>
          <PreviewAction>Preview only · transaction disabled</PreviewAction>
        </section>
      </div>
      <section className="basket-parameters">
        <p className="dapp-section-label">Sample risk parameters</p>
        <dl>
          <div>
            <dt>LTV</dt>
            <dd>75.00%</dd>
          </div>
          <div>
            <dt>Loan duration</dt>
            <dd>30 days</dd>
          </div>
          <div>
            <dt>Mint fee</dt>
            <dd>0.10%</dd>
          </div>
          <div>
            <dt>Flash fee</dt>
            <dd>0.05%</dd>
          </div>
        </dl>
      </section>
    </>
  );
}

const positions = [
  { id: "1042", legs: "3", baskets: "2", stake: "4.250 WETH", rewards: "4" },
  { id: "981", legs: "1", baskets: "0", stake: "1.500 WETH", rewards: "2" },
  { id: "744", legs: "3", baskets: "1", stake: "0 WETH", rewards: "0" },
] as const;

export function PositionListPreview() {
  return (
    <>
      <PreviewBanner surface="PositionNFT portfolio" />
      <section className="position-catalog" aria-labelledby="preview-position-title">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">Sample ownership-reconciled portfolio</p>
            <h2 id="preview-position-title">Your PositionNFTs</h2>
            <p>
              Each NFT carries every attached collateral, staking, reward, loan, and liquidity leg
              when transferred.
            </p>
          </div>
          <PreviewAction>Create PositionNFT · Preview</PreviewAction>
        </div>
        <div className="position-grid">
          {positions.map((position) => (
            <article className="position-card" key={position.id}>
              <div>
                <Link href={`/app/positions/${position.id}`}>Position #{position.id}</Link>
                <span>{position.legs} active legs</span>
              </div>
              <PreviewAddress label="Sample owner" />
              <dl>
                <div>
                  <dt>Basket collateral</dt>
                  <dd>{position.baskets} baskets</dd>
                </div>
                <div>
                  <dt>Global stake</dt>
                  <dd>{position.stake}</dd>
                </div>
                <div>
                  <dt>Reward selections</dt>
                  <dd>{position.rewards}</dd>
                </div>
              </dl>
              <Link className="position-card-link" href={`/app/positions/${position.id}`}>
                Manage sample position →
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
      <PreviewBanner surface="PositionNFT detail" />
      <Link className="basket-back" href="/app/positions">
        ← All positions
      </Link>
      <section className="position-hero">
        <div>
          <p className="dapp-section-label">Sample wallet-owned PositionNFT</p>
          <h2>Position #{positionId.toString()}</h2>
          <PreviewAddress label="Sample owner" />
        </div>
        <dl>
          <div>
            <dt>Active legs</dt>
            <dd>3</dd>
          </div>
          <div>
            <dt>Basket legs</dt>
            <dd>2</dd>
          </div>
          <div>
            <dt>Reward assets</dt>
            <dd>4/64</dd>
          </div>
        </dl>
      </section>
      <p className="dollar-warning">
        Transferring this PositionNFT transfers every attached collateral, staking, reward, loan,
        Dollar, and liquidity obligation.
      </p>
      <div className="position-detail-grid">
        <section className="position-panel">
          <p className="dapp-section-label">Sample basket collateral</p>
          <h3>Manage collateral legs</h3>
          <div className="dollar-tabs preview-four-tabs" aria-label="Sample collateral action">
            {["deposit", "mint", "withdraw", "redeem"].map((mode) => (
              <button
                type="button"
                key={mode}
                className={collateralMode === mode ? "active" : undefined}
                onClick={() => setCollateralMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <label className="basket-field">
            <span>Basket</span>
            <select value="0" disabled>
              <option value="0">#0 · sRESERVE</option>
              <option value="1">#1 · sBLUE</option>
            </select>
          </label>
          <label className="basket-field">
            <span>sRESERVE shares</span>
            <input value="250.00" readOnly />
            <small>Sample wallet: 1,250.00 · Position unlocked: 825.00</small>
          </label>
          <PreviewAction>{collateralMode} collateral · Preview only</PreviewAction>
        </section>
        <section className="position-panel">
          <p className="dapp-section-label">Sample global staking</p>
          <h3>Stake WETH</h3>
          <div className="dollar-tabs" aria-label="Sample staking action">
            {["stake", "unstake"].map((mode) => (
              <button
                type="button"
                key={mode}
                className={stakeMode === mode ? "active" : undefined}
                onClick={() => setStakeMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <dl className="position-metrics">
            <div>
              <dt>Wallet balance</dt>
              <dd>8.425 WETH</dd>
            </div>
            <div>
              <dt>Position stake</dt>
              <dd>4.250 WETH</dd>
            </div>
          </dl>
          <label className="basket-field">
            <span>WETH amount</span>
            <input value="1.00" readOnly />
          </label>
          <p className="position-cooldown">Sample cooldown · unstaking available in 18 hours.</p>
          <PreviewAction>{stakeMode} WETH · Preview only</PreviewAction>
        </section>
      </div>
      <section className="position-panel position-rewards">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">Sample position-selected rewards</p>
            <h3>Choose up to 64 fee assets</h3>
          </div>
          <span>4 selected</span>
        </div>
        <div className="reward-grid">
          {[
            ["Dollar", "128.42", true],
            ["WETH", "0.0241", true],
            ["sRESERVE", "18.20", true],
            ["USDC", "42.80", false],
          ].map(([symbol, pending, selected]) => (
            <article key={String(symbol)} className={selected ? "is-selected" : undefined}>
              <div>
                <strong>{symbol}</strong>
                <span>Sample fee history</span>
              </div>
              <p>Pending: {pending}</p>
              <button type="button" disabled>
                {selected ? "Remove selection" : "Select reward"} · Preview
              </button>
            </article>
          ))}
        </div>
        <p className="dollar-warning">
          Claims remain planned. This preview includes earned balances so the final claim UX can be
          reviewed before implementation.
        </p>
        <PreviewAction>Claim selected rewards · Planned</PreviewAction>
      </section>
      <section className="position-close">
        <div>
          <p className="dapp-section-label">Sample terminal action</p>
          <h3>Close PositionNFT</h3>
          <p>Remove all 3 active legs before closing.</p>
        </div>
        <button type="button" disabled>
          Close PositionNFT
        </button>
      </section>
    </>
  );
}

export function RewardsPreview() {
  return (
    <>
      <PreviewBanner surface="staking and rewards" />
      <div className="rewards-page">
        <section className="position-panel">
          <div className="position-section-heading">
            <div>
              <p className="dapp-section-label">Sample atomic position creation</p>
              <h2>Create and stake</h2>
              <p>Select only the fee assets this PositionNFT should earn.</p>
            </div>
            <span>Total staked: 1,284.52 WETH</span>
          </div>
          <label className="basket-field">
            <span>WETH amount</span>
            <input value="2.50" readOnly />
            <small>Sample wallet balance: 8.425 WETH</small>
          </label>
          <fieldset className="reward-selector">
            <legend>Initial reward selections · 3/64</legend>
            {["Dollar", "WETH", "sRESERVE", "USDC"].map((symbol, index) => (
              <label key={symbol}>
                <input type="checkbox" checked={index < 3} readOnly />
                <span>
                  <strong>{symbol}</strong>
                  Sample discovered asset
                </span>
              </label>
            ))}
          </fieldset>
          <PreviewAction>Approve or create staking position · Preview</PreviewAction>
        </section>
        <section className="position-panel">
          <div className="position-section-heading">
            <div>
              <p className="dapp-section-label">Sample wallet-owned positions</p>
              <h2>Selected rewards</h2>
            </div>
            <span>Claims planned</span>
          </div>
          <div className="reward-position-list">
            {positions.slice(0, 2).map((position, index) => (
              <article key={position.id}>
                <div>
                  <h3>Position #{position.id}</h3>
                  <span>{position.stake} staked</span>
                </div>
                <ul>
                  <li>
                    <span>Dollar</span>
                    <strong>{index === 0 ? "128.42" : "24.18"} pending</strong>
                  </li>
                  <li>
                    <span>WETH</span>
                    <strong>{index === 0 ? "0.0241" : "0.0062"} pending</strong>
                  </li>
                </ul>
                <Link href={`/app/positions/${position.id}`}>
                  Manage sample selections and stake →
                </Link>
              </article>
            ))}
          </div>
          <PreviewAction>Claim selected rewards · Planned</PreviewAction>
        </section>
      </div>
    </>
  );
}

export function ActivityPreview() {
  const sampleActivity = [
    ["Deposit ETH", "2.50 ETH", "Confirmed", "is-confirmed", "2 minutes ago"],
    ["Stake WETH", "1.00 WETH", "Confirming", "is-submitted", "Just now"],
    ["Select Dollar reward", "Dollar", "Rejected", "is-rejected", "Yesterday"],
  ] as const;
  return (
    <>
      <PreviewBanner surface="activity" />
      <section className="activity-panel" aria-labelledby="preview-activity-title">
        <div>
          <p className="dapp-section-label">Sample wallet and network scoped</p>
          <h2 id="preview-activity-title">Protocol activity</h2>
          <p>Representative pending, confirmed, and failed states for visual review.</p>
        </div>
        <ol>
          {sampleActivity.map(([label, amount, status, statusClass, time]) => (
            <li key={label}>
              <div>
                <strong>{label}</strong>
                <span>{amount}</span>
              </div>
              <div>
                <strong className={`activity-status ${statusClass}`}>{status}</strong>
                <time>{time}</time>
              </div>
              <code>0xSample…transaction</code>
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
      <PreviewBanner surface="wallet settings" />
      <section className="dapp-settings" aria-labelledby="preview-settings-title">
        <div className="dapp-settings-heading">
          <p className="dapp-section-label">Sample account</p>
          <h2 id="preview-settings-title">Wallet settings</h2>
          <p>Manage only this Statics sign-in. Logging out does not log you out of Eves Market.</p>
        </div>
        <dl className="dapp-wallet-details">
          <div>
            <dt>Status</dt>
            <dd>Connected · Sample</dd>
          </div>
          <div>
            <dt>Wallet type</dt>
            <dd>Embedded</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>0xA11cE000…00001042</dd>
          </div>
          <div>
            <dt>Target network</dt>
            <dd>Robinhood Chain Testnet</dd>
          </div>
        </dl>
        <div className="dapp-settings-actions">
          <button type="button" disabled>
            Copy sample address
          </button>
          <button type="button" disabled>
            View sample explorer
          </button>
        </div>
        <div className="dapp-export-warning">
          <h3>Export embedded wallet</h3>
          <p>
            The production flow will open Privy’s secure export UI. No recovery material exists in
            this design preview.
          </p>
          <button type="button" disabled>
            Review secure export · Preview
          </button>
        </div>
      </section>
    </>
  );
}
