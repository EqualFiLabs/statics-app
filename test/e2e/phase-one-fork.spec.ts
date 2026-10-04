import { expect, test } from "@playwright/test";

test.skip(
  !process.env.CONNECTED_DAPP_URL,
  "Requires a local fork with Genesis and Phase 1 configured"
);

test("keeps the original swap card and Operator tab with both manifests configured", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/swap");
  await expect(page.getByRole("combobox", { name: "Statics network" })).toHaveValue("anvil");
  await expect(page.getByRole("tab", { name: "Token", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Operator NFT", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: /public pool/i })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /public pool|route/i })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "You pay amount" })).toBeVisible();
  await page.getByRole("tab", { name: "Operator NFT", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Acquire", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Redeem", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Redeem", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Redeem", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByRole("heading", { name: "No Operators NFTs to redeem" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("preserves Operator management and adds Positions Rewards Liquidity and Activity", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const { path, heading, copy } of [
    {
      path: "/app/genesis",
      heading: "Manage your Operators NFTs",
      copy: "Connect to view and manage your Operators NFTs.",
    },
    {
      path: "/app/positions",
      heading: "Your Position NFTs",
      copy: "Create or reuse a position for staking, rewards, and liquidity.",
    },
    {
      path: "/app/rewards",
      heading: "Stake Statics",
      copy: "Reuse a Position you own, or explicitly open a new one, then choose which fee assets it earns.",
    },
    {
      path: "/app/liquidity",
      heading: "Your liquidity",
      copy: "No positions found. Create a position to get started.",
    },
    { path: "/app/activity", heading: "Transactions", copy: "Your activity" },
  ]) {
    await page.goto(path);
    await expect(page.locator("#dapp-content")).toBeVisible();
    await expect(page.getByText("ROUTE UNAVAILABLE", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Application error/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
    await expect(page.getByText(copy, { exact: true }).first()).toBeVisible();
  }
  await page.goto("/app/genesis");
  await expect(page.locator('.dapp-nav-item[href="/app/genesis"]')).toBeVisible();
  await expect(page.locator('.dapp-nav-item[href="/app/positions"]')).toBeVisible();
  await expect(page.locator('.dapp-nav-item[href="/app/rewards"]')).toBeVisible();
  await page.goto("/app/liquidity");
  await expect(page.getByRole("heading", { name: "Your liquidity" })).toBeVisible();
  await expect(page.getByText(/workflow status|saved workflow|maintenance console/i)).toHaveCount(
    0
  );
  await expect(page.getByRole("textbox", { name: /PositionNFT ID/i })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("retains the Funding Portal network selector", async ({ page }) => {
  await page.goto("/app/wallet?modal=portal");
  await expect(page.getByRole("dialog", { name: "Funding Portal" })).toBeVisible();
  await page.getByRole("tab", { name: "Swap", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Funding network" })).toBeVisible();
});
