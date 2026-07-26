import { describe, expect, it } from "vitest";

import { getDappRoutePresentation } from "@/lib/dapp-navigation";
import { appNavigation } from "@/lib/site-config";

/**
 * Guards the consumer-copy rewrite the same way stylelint guards the type
 * scale: the words below describe how the protocol is built, and none of them
 * belong on a screen someone is trying to move money on.
 */
const implementationVocabulary = [
  "positionnft",
  "lp nft",
  "canonical",
  "bilateral",
  "hook-owned",
  "event-discovered",
  "reconciled",
  "tranche",
  "permissionless",
  "eip-2535",
  "diamond",
  "solvency",
  "debt ceiling",
  "principal vector",
  "atomic",
  "wallet-scoped",
  "onchain",
];

const routes: readonly string[] = [
  ...appNavigation.map((item) => item.href),
  // Reachable but not in the sidebar, so they would otherwise go unguarded.
  "/app/portal",
  "/app/create",
];

describe("dapp route copy", () => {
  it("covers every navigable route", () => {
    expect(routes.length).toBeGreaterThan(0);
    for (const href of routes) {
      expect(getDappRoutePresentation(href).title, href).toBeTruthy();
    }
  });

  it("keeps implementation vocabulary out of titles and descriptions", () => {
    for (const href of routes) {
      const { title, description, status, label } = getDappRoutePresentation(href);
      const copy = `${label} ${status} ${title} ${description}`.toLowerCase();
      for (const word of implementationVocabulary) {
        expect(copy.includes(word), `${href} copy contains "${word}"`).toBe(false);
      }
    }
  });

  it("writes titles as something a person can act on, not a noun phrase", () => {
    for (const href of routes) {
      const { title } = getDappRoutePresentation(href);
      // Sentence case, no trailing full stop -- these are headings, not prose.
      expect(title.endsWith("."), `${href} title should not end in a full stop`).toBe(false);
      expect(title, href).toBe(title.trim());
    }
  });

  it("keeps descriptions to a readable length", () => {
    for (const href of routes) {
      const { description } = getDappRoutePresentation(href);
      expect(description.length, `${href} description is too long to scan`).toBeLessThanOrEqual(
        180
      );
    }
  });
});
