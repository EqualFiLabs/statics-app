"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="system-page">
          <p>{"// System fault"}</p>
          <h1>Statics could not load.</h1>
          <span>No wallet or protocol action was submitted.</span>
          <button type="button" onClick={reset}>
            Retry →
          </button>
        </main>
      </body>
    </html>
  );
}
