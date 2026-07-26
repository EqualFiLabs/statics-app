import { expect, type Page, test } from "@playwright/test";

/**
 * The heading each route actually renders, read from the components rather
 * than from route metadata: only the overview renders the route title from
 * lib/dapp-navigation.ts, because the shared summary is scoped to it. The two
 * regexes cover headings built from live data (a balance, a basket name),
 * which have no fixed string to match.
 */
const routes: readonly (readonly [string, string | RegExp])[] = [
  ["/app", "Your portfolio"],
  ["/app/dollar", /Dollar$/],
  ["/app/baskets", "Statics baskets"],
  ["/app/baskets/0", /\S/],
  ["/app/create", "Create a static basket"],
  ["/app/positions", "Your positions"],
  ["/app/loans", "Your loans"],
  ["/app/rewards", "Create and stake"],
  ["/app/liquidity", "Pools and your liquidity"],
  ["/app/activity", "Transactions"],
  ["/app/settings", "Wallet settings"],
];

function monitorBrowserFailures(page: Page): () => void {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  return () => expect(failures, "connected pages must not emit browser errors").toEqual([]);
}

test("renders every connected route without sample fallback", async ({ page }) => {
  const expectNoBrowserFailures = monitorBrowserFailures(page);
  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    // The header's centre slot now reports the live network instead of a
    // static "Protocol DApp" label.
    await expect(page.locator(".dapp-network")).toBeVisible();
    await expect(page.getByText("Local verified", { exact: true })).toBeVisible();
    await expect(page.locator("[data-dapp-preview]")).toHaveCount(0);
    await expect(page.getByText("Design preview", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Sample data only", { exact: true })).toHaveCount(0);
    if (route === "/app/baskets") {
      await expect(page.getByRole("link", { name: "Create basket →" })).toBeVisible();
      await expect(page.getByText("2 discovered", { exact: true })).toBeVisible();
    }
    await page.waitForLoadState("networkidle");
  }
  expectNoBrowserFailures();
});

test("keeps the landing route outside wallet runtime", async ({ page }) => {
  const expectNoBrowserFailures = monitorBrowserFailures(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /static assets.*own your position/i })
  ).toBeVisible();
  await expect(page.locator(".dapp-network")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);
  await expect(page.locator("[data-dapp-preview]")).toHaveCount(0);
  expectNoBrowserFailures();
});

test("exposes a real Privy entry point without claiming identity proof", async ({ page }) => {
  const expectNoBrowserFailures = monitorBrowserFailures(page);
  await page.goto("/app");
  const signIn = page.getByRole("button", { name: "Sign in" });
  await expect(signIn).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
  await expect(page.getByText("Signed out", { exact: true })).toBeVisible();
  await signIn.click();
  await expect(page.getByText("Log in or sign up", { exact: true })).toBeVisible();
  await expect(page.getByText("Continue with a wallet", { exact: true })).toBeVisible();
  expectNoBrowserFailures();
});
