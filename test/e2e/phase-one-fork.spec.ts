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
  // Cold development compilation visits nine independent routes sequentially.
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const { path, heading, copy, target } of [
    {
      path: "/app/genesis",
      heading: "Manage your Operators NFTs",
      copy: "Connect to view and manage your Operators NFTs.",
    },
    {
      path: "/app/positions",
      heading: "Your accounts",
      copy: "Each account is a Position NFT. Open one to see its balances, history and controls.",
    },
    {
      path: "/app/rewards",
      heading: "Earn",
      copy: "Your stake and rewards, across every account.",
    },
    {
      path: "/app/rewards/staking",
      heading: "Staking",
      copy: "Stake STATICS and choose the assets you earn.",
    },
    {
      path: "/app/rewards/gauge",
      heading: "Liquidity rewards",
      copy: "STATICS emissions and incentives earned by your in-range liquidity.",
    },
    {
      path: "/app/rewards/bribes?share=lp",
      target: "/app/rewards/gauge",
      heading: "Liquidity rewards",
      copy: "STATICS emissions and incentives earned by your in-range liquidity.",
    },
    {
      path: "/app/rewards/allocations",
      heading: "Allocations",
      copy: "Point staked STATICS at pools to direct emissions to their LPs and earn allocator incentives.",
    },
    {
      path: "/app/liquidity",
      heading: "Your liquidity",
      copy: "Provide liquidity to earn trading fees and pool incentives.",
    },
    {
      path: "/app/rewards/bribes?share=allocator&positionId=34",
      target: "/app/rewards/allocations?positionId=34",
      heading: "Allocations",
      copy: "Point staked STATICS at pools to direct emissions to their LPs and earn allocator incentives.",
    },
    { path: "/app/activity", heading: "Transactions", copy: "Your activity" },
  ]) {
    await page.goto(path);
    if (target) await expect(page).toHaveURL(new URL(target, page.url()).toString());
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
