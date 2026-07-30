import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Navigates to a destination the way a person would at this viewport.
 *
 * Account plumbing sits in the header on desktop and in the sidebar panel on
 * mobile, so this asserts the destination is reachable rather than that it
 * lives in one particular place.
 */
async function navigateDapp(page: Page, href: string) {
  const toggle = page.locator(".dapp-nav-toggle");
  if (await toggle.isVisible()) {
    await toggle.click();
  }
  const sidebarItem = page.locator(`.dapp-nav-item[href="${href}"]`);
  if (await sidebarItem.isVisible()) {
    await sidebarItem.click();
    return;
  }
  const headerLink = page.locator(`.dapp-header-link[href="${href}"]`);
  if ((await headerLink.count()) > 0) {
    await headerLink.click();
    return;
  }
  // Contextual and retired destinations have no primary menu entry.
  await page.goto(href);
}

test.describe("landing foundation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("reports the public testnet beta without horizontal overflow", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /static assets.*dynamic markets/i })
    ).toBeVisible();
    await expect(page.getByText("Public testnet beta").first()).toBeVisible();
    await expect(page.getByText("19,482,731")).toHaveCount(0);
    await expect(page.getByText("Online", { exact: true })).toHaveCount(0);

    const root = page.locator("html");
    const overflow = await root.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
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
      .getByRole("link", { name: /launch app/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app$/);
    // Matches the overview title from lib/dapp-navigation.ts. Its exact wording
    // is guarded by test/foundation/route-copy.test.ts; this only asserts that
    // the destination rendered.
    await expect(page.getByRole("heading", { name: "Your portfolio", level: 1 })).toBeVisible();
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
  test("provides every reviewable DApp destination", async ({ page }) => {
    await page.goto("/app");
    await navigateDapp(page, "/app/wallet");
    await expect(page).toHaveURL(/\/app\/wallet$/);
    await page.getByRole("button", { name: /portal/i }).click();
    await expect(page.getByRole("dialog", { name: "Funding Portal" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Funding Portal" })).toHaveCount(0);

    await page.goto("/app/portal");
    await expect(page).toHaveURL(/\/app\/wallet\?modal=portal$/);
    await expect(page.getByRole("dialog", { name: "Funding Portal" })).toBeVisible();
    await page.keyboard.press("Escape");

    await navigateDapp(page, "/app/dollar");
    await expect(page).toHaveURL(/\/app\/dollar$/);

    await navigateDapp(page, "/app/baskets");
    await expect(page).toHaveURL(/\/app\/baskets$/);
    await page.goto("/app/baskets/0");
    await expect(page).toHaveURL(/\/app\/baskets\/0$/);
    await page.goto("/app/create");
    await expect(
      page.getByRole("heading", { name: "Basket launches are steward-controlled" })
    ).toBeVisible();

    await page.goto("/app/positions");
    await expect(page).toHaveURL(/\/app\/positions$/);
    await page.goto("/app/positions/0");
    await expect(page).toHaveURL(/\/app\/positions\/0$/);

    await navigateDapp(page, "/app/loans");
    await expect(page).toHaveURL(/\/app\/loans$/);

    await navigateDapp(page, "/app/rewards");
    await expect(page).toHaveURL(/\/app\/rewards$/);

    await navigateDapp(page, "/app/liquidity");
    await expect(page).toHaveURL(/\/app\/liquidity$/);

    await navigateDapp(page, "/app/activity");
    await expect(page).toHaveURL(/\/app\/activity$/);

    await navigateDapp(page, "/app/faucet");
    await expect(page).toHaveURL(/\/app\/faucet$/);

    await navigateDapp(page, "/app/tools");
    await expect(page).toHaveURL(/\/app\/tools$/);
  });

  test("provides an accessible responsive application menu", async ({ page }, testInfo) => {
    await page.goto("/app");
    const toggle = page.locator(".dapp-nav-toggle");

    if (testInfo.project.name === "desktop") {
      await expect(toggle).toBeHidden();
      await expect(page.locator('.dapp-nav-item[href="/app/baskets"]')).toBeVisible();
      return;
    }

    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#dapp-navigation-panel")).toBeVisible();
    await expect(page.locator('.dapp-nav-item[href="/app"]')).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();

    await toggle.click();
    await page.locator('.dapp-nav-item[href="/app/baskets"]').click();
    await expect(page).toHaveURL(/\/app\/baskets$/);
    await expect(page.locator(".dapp-nav-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".dapp-nav-toggle")).toHaveAttribute(
      "aria-label",
      "Application menu. Current route: Baskets"
    );
  });

  test("keeps governed basket creation informational", async ({ page }) => {
    await page.goto("/app/create");

    await expect(
      page.getByRole("heading", { name: "Basket launches are steward-controlled" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /create basket/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Browse baskets" })).toHaveAttribute(
      "href",
      "/app/baskets"
    );
  });

  test("keeps the basket route responsive and accessible", async ({ page }) => {
    await page.goto("/app/baskets");
    await expect(page.locator('.dapp-nav-item[href="/app/baskets"]')).toHaveAttribute(
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

  test("keeps broader protocol routes responsive and accessible", async ({ page }) => {
    for (const route of [
      "/app/create",
      "/app/positions",
      "/app/positions/1042",
      "/app/loans",
      "/app/rewards",
      "/app/liquidity",
      "/app/faucet",
      "/app/tools",
    ]) {
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
