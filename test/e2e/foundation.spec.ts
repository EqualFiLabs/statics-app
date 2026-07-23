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
      page.getByRole("heading", { name: "Protocol interface foundation." })
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

test.describe("DApp foundation", () => {
  test("shows a read-only shell with no simulated wallet state", async ({ page }, testInfo) => {
    await page.goto("/app");
    await expect(page.getByText("Foundation ready")).toBeVisible();
    await expect(page.getByText("Not integrated")).toBeVisible();
    await expect(page.getByRole("button", { name: /connect/i })).toHaveCount(0);
    await expect(page.getByText(/0x[0-9a-f]{8}/i)).toHaveCount(0);

    await expect(page).toHaveScreenshot(`app-${testInfo.project.name}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.005,
    });
  });

  test("renders the branded not-found state", async ({ page }) => {
    await page.goto("/missing-surface");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByRole("link", { name: /return home/i })).toHaveAttribute("href", "/");
  });
});
