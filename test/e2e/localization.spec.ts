import { expect, test } from "@playwright/test";

test.describe("localization", () => {
  test("negotiates the first visit from the browser without changing the URL", async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: "es-MX" });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: /abrir aplicación/i }).first()).toBeVisible();
    await context.close();
  });

  test("persists an explicit preference across marketing and application routes", async ({
    page,
  }) => {
    await page.goto("/");
    const menuToggle = page.getByRole("button", { name: "Toggle navigation" });
    if (await menuToggle.isVisible()) await menuToggle.click();
    const locale = page.getByRole("combobox", { name: /change language/i }).first();
    await locale.selectOption("zh-CN");

    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/app/baskets");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("heading", { name: "Statics 尚未配置", level: 3 })).toBeVisible();
  });

  test("preference cookie takes precedence over the browser language", async ({
    context,
    page,
  }) => {
    await context.setExtraHTTPHeaders({ "accept-language": "zh-CN,zh;q=0.9" });
    await context.addCookies([
      {
        name: "statics-locale",
        value: "en",
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/app");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "Statics Genesis", level: 1 })).toBeVisible();
  });
});
