"use client";

export default function DAppError({ reset }: { reset: () => void }) {
  return (
    <section className="dapp-next-phase" role="alert">
      <div>
        <p className="dapp-section-label">{"// Application fault"}</p>
        <h2>The DApp shell could not load.</h2>
      </div>
      <p>No wallet or protocol action was submitted. Retry this read-only surface safely.</p>
      <button type="button" className="dapp-return" onClick={reset}>
        Retry →
      </button>
    </section>
  );
}
