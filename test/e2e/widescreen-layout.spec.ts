import { expect, test } from "@playwright/test";

test.describe("DApp widescreen layout", () => {
  test("centers the capped content column beside the desktop sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto("/app");

    const layout = await page.locator(".dapp-layout").boundingBox();
    const sidebar = await page.locator(".dapp-sidebar").boundingBox();
    const content = await page.locator(".dapp-content").boundingBox();

    expect(layout).not.toBeNull();
    expect(sidebar).not.toBeNull();
    expect(content).not.toBeNull();
    if (!layout || !sidebar || !content) return;

    const contentColumnLeft = sidebar.x + sidebar.width;
    const contentColumnRight = layout.x + layout.width;
    const leftGap = content.x - contentColumnLeft;
    const rightGap = contentColumnRight - (content.x + content.width);

    expect(content.width).toBeLessThanOrEqual(1180);
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2);
  });
});
