import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DApp Foundation",
  description: "The pre-launch Statics application foundation.",
};

export default function DAppOverviewPage() {
  return (
    <section className="dapp-next-phase" aria-labelledby="next-phase-title">
      <div>
        <p className="dapp-section-label">Next integration</p>
        <h2 id="next-phase-title">One wallet across Statics and Eves.</h2>
      </div>
      <p>
        The next phase adds the reviewed Privy and Wagmi provider boundary. No wallet address,
        balance, network, or protocol action is simulated here.
      </p>
      <ul>
        <li>Shared Privy user and embedded wallet</li>
        <li>Statics-specific delegated signer and policies</li>
        <li>External-wallet confirmation preserved</li>
      </ul>
    </section>
  );
}
