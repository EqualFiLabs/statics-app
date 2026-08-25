import { expect, type Page, test } from "@playwright/test";

function monitorBrowserFailures(page: Page): () => void {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text === "TypeError: Failed to fetch" || text.includes("Cross-Origin-Opener-Policy"))
      return;
    failures.push(`console: ${text}`);
  });
  return () => expect(failures, "Genesis fork pages must not emit browser errors").toEqual([]);
}

async function selectLocalDeployment(page: Page) {
  await page.goto("/app");
  await expect(page.getByRole("combobox", { name: "Statics network" })).toHaveValue("anvil");
  await expect(page.getByRole("heading", { name: "Statics Genesis" })).toBeVisible();
}

test("renders the complete standalone Genesis launch surface on the local fork", async ({
  page,
}) => {
  const expectNoBrowserFailures = monitorBrowserFailures(page);
  await selectLocalDeployment(page);
  await expect(page.getByText("Vault backing", { exact: true })).toBeVisible();
  await expect(page.getByText("Vault inventory", { exact: true })).toBeVisible();

  await page.goto("/app/swap");
  await expect(page.getByRole("tab", { name: "Token" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("combobox", { name: "You receive asset" })).toHaveValue(
    /^0x[a-fA-F0-9]{40}$/
  );
  await expect(page.getByRole("combobox", { name: "You pay asset" })).toContainText("WETH");
  await page.getByRole("tab", { name: "NFT" }).click();
  await expect(page.getByRole("heading", { name: "Fully backed Genesis inventory" })).toBeVisible();
  await expect(page.getByText("STATICS backing", { exact: true })).toBeVisible();
  await expect(page.getByText("Reserve buy-in", { exact: true })).toBeVisible();
  await expect(page.getByText("Acquisition fee", { exact: true })).toBeVisible();
  await expect(page.getByText("Total ETH required", { exact: true })).toBeVisible();
  await expect(page.getByText("Genesis Epoch", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Acquire Genesis NFT" })).toBeVisible();

  await page.goto("/app/genesis");
  await expect(page.getByRole("heading", { name: "Connect your wallet" })).toBeVisible();
  await expect(page.getByText(/view and manage your Genesis NFTs/i)).toBeVisible();

  await page.goto("/app/genesis-rewards");
  await expect(page.getByRole("heading", { name: "Connect your wallet" })).toBeVisible();
  await expect(page.getByText(/register Genesis NFTs and claim launch rewards/i)).toBeVisible();
  expectNoBrowserFailures();
});

test("does not expose a fake browser transfer path", async ({ page }) => {
  await page.goto("/app/genesis");
  await expect(page.getByRole("button", { name: /transfer genesis|send genesis/i })).toHaveCount(0);
  await expect(page.getByText(/Transferring this Genesis NFT resets its activation/i)).toHaveCount(
    0
  );
});
