import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * jsdom implements no layout, and so ships no ResizeObserver. Components that
 * measure themselves -- the Genesis carousel decides whether it can still page
 * -- would otherwise throw on mount. The stub reports nothing, which matches
 * the zero-sized boxes jsdom already reports everywhere else.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

afterEach(() => cleanup());
