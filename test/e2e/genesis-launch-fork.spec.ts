import { expect, type Page, test } from "@playwright/test";

function monitorBrowserFailures(page: Page): () => void {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (
      text === "TypeError: Failed to fetch" ||
      text.includes("Cross-Origin-Opener-Policy") ||
      text.includes("Failed to load resource: the server responded with a status of 404")
    )
      return;
    failures.push(`console: ${text}`);
  });
  return () => expect(failures, "Genesis fork pages must not emit browser errors").toEqual([]);
}

async function selectLocalDeployment(page: Page) {
  await page.goto("/app");
  await expect(page.getByRole("combobox", { name: "Statics network" })).toHaveValue("anvil");
  await expect(page.getByRole("heading", { name: "Statics Operators" })).toBeVisible();
}

test("renders the Operators launch-only surface and contextual utilities on the local fork", async ({
  page,
}) => {
  const expectNoBrowserFailures = monitorBrowserFailures(page);
  await selectLocalDeployment(page);

  await expect(page.locator(".dapp-nav-item")).toHaveText([
    "Overview",
    "Trade",
    "My Operators",
    "Wallet",
  ]);
  await expect(page.locator(".dapp-tabbar .dapp-tab:not(.dapp-nav-toggle)")).toHaveText([
    "Trade",
    "My Operators",
    "Wallet",
  ]);
  await expect(page.getByRole("link", { name: "Add funds" })).toHaveAttribute(
    "href",
    "/app/portal"
  );
  await expect(page.getByText("Dollar", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Baskets", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Position NFT", { exact: true })).toHaveCount(0);

  for (const href of ["/app", "/app/swap", "/app/genesis"]) {
    await page.goto(href);
    await expect(page).toHaveURL(new RegExp(`${href.replace("?", "\\?")}$`));
  }
  await page.goto("/app/genesis-rewards");
  await expect(page).toHaveURL(/\/app\/genesis$/);

  await page.goto("/app/positions");
  await page.goto("/app/unknown");
  await expect(page.getByText("ROUTE UNAVAILABLE")).toBeVisible();
  await page.goto("/app");

  await page.locator('.dapp-nav-item[href="/app/wallet"]').click();
  await expect(page).toHaveURL(/\/app\/wallet$/);
  await expect(page.getByRole("link", { name: /activity/i })).toBeVisible();
  await page.goto("/app/portal");
  await expect(page).toHaveURL(/\/app\/wallet\?modal=portal$/);
  await expect(page.getByRole("dialog", { name: "Funding Portal" })).toBeVisible();
  await page.goto("/app/tools");
  await expect(page).toHaveURL(/\/app\/tools$/);
  expectNoBrowserFailures();
});

test("does not expose a fake browser transfer path", async ({ page }) => {
  await page.goto("/app/genesis");
  await expect(page.getByRole("button", { name: /transfer genesis|send genesis/i })).toHaveCount(0);
  await expect(page.getByText(/Transferring this Operator NFT resets its activation/i)).toHaveCount(
    0
  );
});
