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
  ["/app/create", "Basket launches are steward-controlled"],
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
  // Signed-out state is shown by the controls themselves and by the overview's
  // empty state, rather than by a status card.
  await expect(page.getByText("Sign in to see your portfolio")).toBeVisible();
  await signIn.click();
  await expect(page.getByText("Log in or sign up", { exact: true })).toBeVisible();
  await expect(page.getByText("Continue with a wallet", { exact: true })).toBeVisible();
  expectNoBrowserFailures();
});

/**
 * The Dollar page's five modes, driven through the actual controls.
 *
 * This exists because the supply and withdraw modes shipped completely
 * non-functional and unit tests could not see it: the step logic was correct in
 * isolation, but `executeNextAction` gated every click behind a Dollar quote
 * that supply modes never produce, so the button threw "Wait for a fresh
 * protocol preview." A CLI harness calling the lib functions passed. Only
 * clicking the button finds this class of defect.
 */
test("every Dollar mode reaches a live action rather than a preview gate", async ({ page }) => {
  const expectNoBrowserFailures = monitorBrowserFailures(page);
  await page.goto("/app/dollar");

  const amount = page.locator("#dollar-amount");
  const action = page.locator("button.dollar-submit");

  for (const [label, unit] of [
    ["Deposit", /ETH|WETH/],
    ["Recombine", /Dollar/],
    ["Redeem", /Dollar/],
    ["Supply", /Risk shares/],
    ["Withdraw", /Risk shares/],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();

    // The field has to be denominated in what the mode actually moves.
    await expect(page.getByText(unit).first()).toBeVisible();

    await amount.fill("1");
    // Whatever the mode decides, it must resolve to a real label rather than
    // sitting on a preview that will never arrive for this route.
    await expect(action).not.toHaveText(/Load preview|Refreshing preview/, { timeout: 15_000 });

    if (await action.isEnabled()) {
      await action.click();
      // The failure this guards: an enabled button that throws a quote error
      // instead of acting. Any wallet prompt or protocol reason is acceptable;
      // "wait for a preview" on a route that has no preview is not.
      await expect(page.getByText(/Wait for a fresh protocol preview/)).toHaveCount(0);
    }
    await amount.fill("");
  }
  expectNoBrowserFailures();
});
