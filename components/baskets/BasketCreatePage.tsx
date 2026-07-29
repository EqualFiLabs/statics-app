import Link from "next/link";

export function BasketCreatePage() {
  return (
    <>
      <section className="remaining-hero">
        <div>
          <p className="dapp-section-label">Launch policy</p>
          <h2>Basket launches are steward-controlled</h2>
          <p>
            Public basket creation is closed during the Robinhood testnet beta. Launches use the
            same backed basket and canonical-pool flow, but the reviewed transaction is executed
            through Statics governance.
          </p>
        </div>
        <span className="remaining-status is-warmup">Governed launch</span>
      </section>
      <section className="creation-workspace">
        <div className="creation-review">
          <section>
            <p className="dapp-section-label">What this means</p>
            <h3>No public creation transaction is offered</h3>
            <ul>
              <li>Existing baskets remain permissionless to mint, redeem, trade, and use.</li>
              <li>Each new basket launches with reviewed backing and canonical pool parameters.</li>
              <li>Public launches can be enabled later through the protocol creation fee.</li>
            </ul>
          </section>
          <section>
            <p className="dapp-section-label">Available now</p>
            <h3>Use the live basket catalog</h3>
            <p>Inspect each basket&apos;s constituents, status, fees, and canonical liquidity.</p>
            <Link className="ui-button ui-button--primary" href="/app/baskets">
              Browse baskets
            </Link>
          </section>
        </div>
      </section>
    </>
  );
}
