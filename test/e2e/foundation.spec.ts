import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("landing foundation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("preserves the visual system and truthful pre-launch state", async ({ page }, testInfo) => {
    await expect(
      page.getByRole("heading", { name: /static assets.*own your position/i })
    ).toBeVisible();
    await expect(page.getByText("Pre-launch").first()).toBeVisible();
    await expect(page.getByText("19,482,731")).toHaveCount(0);
    await expect(page.getByText("Online", { exact: true })).toHaveCount(0);

    const root = page.locator("html");
    const overflow = await root.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await expect(page).toHaveScreenshot(`landing-${testInfo.project.name}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      mask: [page.locator("time")],
      maskColor: "#050605",
      maxDiffPixelRatio: 0.005,
    });
  });

  test("routes to the app while future links remain visible placeholders", async ({ page }) => {
    const placeholders = page.locator("[data-placeholder-link]");
    await expect(placeholders).not.toHaveCount(0);
    await expect(page.getByText("GitHub", { exact: true })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await expect(page.getByRole("link", { name: "GitHub" })).toHaveCount(0);

    await page
      .getByRole("link", { name: /launch dapp/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole("heading", { name: "Issue and redeem Statics Dollar." })
    ).toBeVisible();
  });

  test("supports keyboard entry and responsive navigation", async ({ page }, testInfo) => {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

    if (testInfo.project.name === "mobile") {
      const toggle = page.getByRole("button", { name: "Toggle navigation" });
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
      await page.getByRole("link", { name: "Baskets", exact: true }).click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    const scrollBehavior = await page
      .locator("html")
      .evaluate((element) => window.getComputedStyle(element).scrollBehavior);
    expect(scrollBehavior).toBe("auto");
  });

  test("has no serious or critical automated accessibility findings", async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical"
    );
    expect(blocking).toEqual([]);
  });

  test("returns security headers", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});

test.describe("Dollar DApp foundation", () => {
  test("shows a labelled sample portfolio without simulated wallet readiness", async ({
    page,
  }, testInfo) => {
    await page.goto("/app");
    await expect(
      page.locator(".dapp-status-card strong").filter({ hasText: "Sample interface" })
    ).toBeVisible();
    await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
    await expect(page.getByText("Sample data only", { exact: true })).toBeVisible();
    await expect(page.locator("[data-dapp-preview]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Wallet not configured" })).toBeDisabled();
    await expect(page.getByText("12,480.52 Dollar")).toBeVisible();

    await expect(page).toHaveScreenshot(`app-${testInfo.project.name}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.005,
    });
  });

  test("provides Dollar, baskets, positions, rewards, activity, and settings", async ({ page }) => {
    await page.goto("/app");
    await page.locator('.dapp-nav-item[href="/app/dollar"]').click();
    await expect(page).toHaveURL(/\/app\/dollar$/);
    await expect(page.getByText("Sample Dollar data")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Preview only · connect local deployment" })
    ).toBeDisabled();

    await page.locator('.dapp-nav-item[href="/app/baskets"]').click();
    await expect(page).toHaveURL(/\/app\/baskets$/);
    await expect(page.getByRole("heading", { name: "Statics baskets" })).toBeVisible();

    await page.locator('.dapp-nav-item[href="/app/positions"]').click();
    await expect(page).toHaveURL(/\/app\/positions$/);
    await expect(page.getByRole("heading", { name: "Your PositionNFTs" })).toBeVisible();

    await page.locator('.dapp-nav-item[href="/app/rewards"]').click();
    await expect(page).toHaveURL(/\/app\/rewards$/);
    await expect(page.getByRole("heading", { name: "Create and stake" })).toBeVisible();

    await page.locator('.dapp-nav-item[href="/app/activity"]').click();
    await expect(page).toHaveURL(/\/app\/activity$/);
    await expect(page.getByRole("heading", { name: "Protocol activity" })).toBeVisible();

    await page.locator('.dapp-nav-item[href="/app/settings"]').click();
    await expect(page).toHaveURL(/\/app\/settings$/);
    await expect(page.getByRole("heading", { name: "Wallet settings" })).toBeVisible();
  });

  test("captures every populated DApp preview surface", async ({ page }, testInfo) => {
    const surfaces = [
      ["dollar", "/app/dollar"],
      ["basket-detail", "/app/baskets/0"],
      ["position-detail", "/app/positions/1042"],
      ["rewards", "/app/rewards"],
      ["activity", "/app/activity"],
      ["settings", "/app/settings"],
    ] as const;

    for (const [name, route] of surfaces) {
      await page.goto(route);
      await expect(page.locator("[data-dapp-preview]")).toBeVisible();
      await expect(page).toHaveScreenshot(`app-${name}-${testInfo.project.name}.png`, {
        fullPage: true,
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.005,
      });
    }
  });

  test("keeps the basket route responsive and accessible", async ({ page }) => {
    await page.goto("/app/baskets");
    await expect(
      page.getByRole("heading", { name: "Inspect, mint, and redeem static baskets." })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /baskets/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    const overflow = await page
      .locator("html")
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to application content" })).toBeFocused();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical"
    );
    expect(blocking).toEqual([]);
  });

  test("keeps position and reward routes responsive and accessible", async ({ page }) => {
    for (const route of ["/app/positions", "/app/positions/1042", "/app/rewards"]) {
      await page.goto(route);
      const overflow = await page
        .locator("html")
        .evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical"
      );
      expect(blocking).toEqual([]);
    }
  });

  test("renders the branded not-found state", async ({ page }) => {
    await page.goto("/missing-surface");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByRole("link", { name: /return home/i })).toHaveAttribute("href", "/");
  });
});
