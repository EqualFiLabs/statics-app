import { describe, expect, it } from "vitest";

import { getDappRoutePresentation } from "@/lib/dapp-navigation";
import { appHeaderNavigation, appNavigation, appNavigationGroups } from "@/lib/site-config";

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

describe("dapp navigation grouping", () => {
  it("groups every route under a heading, except the home link", () => {
    const [first, ...rest] = appNavigationGroups;
    expect(first.label).toBeNull();
    expect(first.items.map((item) => item.href)).toEqual(["/app"]);
    for (const group of rest) {
      expect(group.label, JSON.stringify(group.items)).toBeTruthy();
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it("leads with Earn, because staking is the part that reads as a savings product", () => {
    expect(appNavigationGroups[1].label).toBe("Earn");
  });

  it("keeps every route exactly once across the groups", () => {
    // Regrouping must not silently drop or duplicate a destination.
    const hrefs = appNavigationGroups.flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toHaveLength(10);
  });

  it("keeps the flattened list in step with the groups", () => {
    // appNavigation is derived, and other callers depend on it.
    expect(appNavigation.map((item) => item.href)).toEqual(
      appNavigationGroups.flatMap((group) => group.items.map((item) => item.href))
    );
  });

  it("uses group labels a person would recognise", () => {
    for (const group of appNavigationGroups) {
      if (!group.label) continue;
      expect(group.label).toBe(group.label.trim());
      // Headings name an intent, not a protocol subsystem.
      expect(group.label.toLowerCase()).not.toMatch(/facet|diamond|nft|protocol/);
    }
  });
});

describe("secondary navigation", () => {
  it("keeps account plumbing out of the primary destinations", () => {
    expect(appHeaderNavigation.map((item) => item.href)).toEqual([
      "/app/activity",
      "/app/settings",
    ]);
  });

  it("counts the primary destinations, which is what a tab bar has to fit", () => {
    const primary = appNavigation.filter((item) => !item.secondary);
    expect(primary).toHaveLength(8);
  });

  it("never moves a route to the header without leaving it navigable", () => {
    // Header items are still in the groups, so the mobile panel lists them.
    for (const item of appHeaderNavigation) {
      expect(appNavigation.some((candidate) => candidate.href === item.href)).toBe(true);
    }
  });
});
