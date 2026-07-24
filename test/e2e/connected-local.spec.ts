import { expect, type Page, test } from "@playwright/test";

const routes = [
  ["/app", "Track your Statics portfolio."],
  ["/app/dollar", "Issue and redeem Statics Dollar."],
  ["/app/baskets", "Inspect, mint, and redeem static baskets."],
  ["/app/baskets/0", "Inspect, mint, and redeem static baskets."],
  ["/app/create", "Configure a new static basket."],
  ["/app/positions", "Manage each wallet-owned PositionNFT."],
  ["/app/loans", "Review independent loan tranches."],
  ["/app/rewards", "Create stake positions with selected rewards."],
  ["/app/liquidity", "Manage canonical v4 liquidity."],
  ["/app/activity", "Review protocol activity."],
  ["/app/settings", "Manage your Statics wallet."],
] as const;

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
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("Protocol DApp", { exact: true })).toBeVisible();
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
  await expect(page.getByText("Protocol DApp", { exact: true })).toHaveCount(0);
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
