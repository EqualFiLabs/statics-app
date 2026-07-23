"use client";

export default function RouteError({ reset }: { reset: () => void }) {
  return (
    <main className="system-page" role="alert">
      <p>{"// Route fault"}</p>
      <h1>This Statics surface could not load.</h1>
      <span>No wallet or protocol action was submitted.</span>
      <button type="button" onClick={reset}>
        Retry →
      </button>
    </main>
  );
}
