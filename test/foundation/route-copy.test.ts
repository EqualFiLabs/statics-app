import { describe, expect, it } from "vitest";

import {
  getDappRouteCapability,
  getDappRoutePresentation,
  isDappRouteAllowed,
} from "@/lib/dapp-navigation";
import {
  appNavigation,
  appNavigationGroups,
  appNavigationGroupsForStage,
  appTabNavigation,
  appTabNavigationForStage,
} from "@/lib/site-config";
import english from "@/messages/en.json";
import spanish from "@/messages/es.json";
import chinese from "@/messages/zh-CN.json";

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
  "constituent",
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

describe("stage-aware dapp navigation", () => {
  const launch = {
    deploymentId: "launch",
    label: "Genesis launch",
    network: "Robinhood Chain",
    chainId: 4663,
    stage: "launch" as const,
    capabilities: [],
    available: true,
  };

  it("selects the launch product plus Wallet in the sidebar and four product tabs", () => {
    const groups = appNavigationGroupsForStage("launch");
    expect(groups.flatMap((group) => group.items.map((item) => item.href))).toEqual([
      "/app",
      "/app/swap",
      "/app/genesis",
      "/app/genesis-rewards",
      "/app/wallet",
    ]);
    expect(appTabNavigationForStage("launch").map((item) => item.href)).toEqual([
      "/app",
      "/app/swap",
      "/app/genesis",
      "/app/genesis-rewards",
    ]);
    expect(groups.every((group) => group.items.every((item) => item.enabled))).toBe(true);
  });

  it("allows launch contextual utilities but rejects unsupported known routes", () => {
    expect(isDappRouteAllowed("/app/genesis-rewards", launch)).toBe(true);
    expect(isDappRouteAllowed("/app/wallet", launch)).toBe(true);
    expect(isDappRouteAllowed("/app/activity", launch)).toBe(true);
    expect(isDappRouteAllowed("/app/tools", launch)).toBe(true);
    expect(isDappRouteAllowed("/app/positions/1042", launch)).toBe(false);
    expect(isDappRouteAllowed("/app/unknown", launch)).toBe(true);
    expect(getDappRouteCapability("/app/unknown")).toBeNull();
    expect(getDappRouteCapability("/app/positions/1042")).toBe("positions");
  });

  it("leaves the complete catalog unchanged for full protocol", () => {
    expect(appNavigationGroupsForStage("full-protocol")).toBe(appNavigationGroups);
    expect(appTabNavigationForStage("full-protocol")).toBe(appTabNavigation);
  });
});

describe("dapp navigation grouping", () => {
  it("groups every route under a heading, except the home link", () => {
    const [first, ...rest] = appNavigationGroups;
    expect(first.label).toBeNull();
    expect(first.items.map((item) => item.href)).toEqual(["/app", "/app/swap"]);
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
    expect(hrefs).toHaveLength(15);
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

describe("sidebar completeness", () => {
  it("keeps the primary menu focused on destination surfaces", () => {
    expect(appNavigation.map((item) => item.label)).toEqual([
      "Overview",
      "Swap",
      "Earn",
      "Liquidity",
      "Baskets",
      "Create basket",
      "Dollar",
      "Position NFT",
      "Genesis NFT",
      "Genesis Rewards",
      "Loans",
      "Wallet",
      "Faucet",
      "Activity",
      "Tools",
    ]);
  });

  it("keeps position management directly discoverable", () => {
    const manage = appNavigationGroups.find((group) => group.label === "Manage");
    expect(manage?.items.map((item) => item.href)).toEqual([
      "/app/positions",
      "/app/genesis",
      "/app/genesis-rewards",
      "/app/loans",
    ]);
  });

  it("uses the exact NFT product labels in every locale", () => {
    for (const messages of [english, spanish, chinese]) {
      expect(messages.navigation.items.positions).toBe("Position NFT");
      expect(messages.navigation.items.genesis).toBe("Genesis NFT");
    }
  });

  it("keeps account plumbing grouped rather than promoted", () => {
    const account = appNavigationGroups.find((group) => group.label === "Account");
    expect(account?.items.map((item) => item.href)).toEqual([
      "/app/wallet",
      "/app/faucet",
      "/app/activity",
      "/app/tools",
    ]);
  });
});

describe("mobile tab bar", () => {
  it("leaves room for the menu inside the five-slot limit", () => {
    // The bar holds five slots at 390px. The menu takes the last one, so four
    // destinations are promoted and everything else lives behind it.
    expect(appTabNavigation).toHaveLength(4);
    expect(appTabNavigation.map((item) => item.tabLabel)).toEqual([
      "Earn",
      "Baskets",
      "Dollar",
      "Wallet",
    ]);
  });

  it("uses short labels, because a tab is about a thumb wide", () => {
    for (const item of appTabNavigation) {
      expect(item.tabLabel, item.href).toBeTruthy();
      expect(item.tabLabel!.length, `${item.tabLabel} is too long for a tab`).toBeLessThanOrEqual(
        8
      );
    }
  });

  it("only ever promotes a destination that earns a sidebar slot too", () => {
    // A tab for something not in the sidebar would be the only way to reach it,
    // which is exactly the trap the panel exists to avoid.
    for (const item of appTabNavigation) {
      expect(appNavigation).toContain(item);
    }
  });

  it("does not promote the overview, which the menu reaches", () => {
    // Home is one tap away through the menu, and the slot buys a destination
    // you cannot otherwise reach in one tap.
    expect(appTabNavigation.some((item) => item.href === "/app")).toBe(false);
    expect(appTabNavigation.at(-1)!.href).toBe("/app/wallet");
  });
});
