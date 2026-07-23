import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DApp",
  description: "Sign into the Statics application and manage your wallet connection.",
};

export default function DAppOverviewPage() {
  return (
    <section className="dapp-next-phase" aria-labelledby="wallet-foundation-title">
      <div>
        <p className="dapp-section-label">Wallet foundation</p>
        <h2 id="wallet-foundation-title">A normal sign-in for Statics.</h2>
      </div>
      <p>
        Email users receive or reuse a Privy embedded EVM wallet. External-wallet users keep their
        ordinary wallet confirmation flow. No delegated signing is enabled in this application.
      </p>
      <ul>
        <li>Robinhood Chain Testnet target</li>
        <li>Independent Statics session</li>
        <li>No contract actions in this phase</li>
      </ul>
    </section>
  );
}
