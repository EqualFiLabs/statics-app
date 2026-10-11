import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ponder", () => ({ createConfig: (config: unknown) => config }));

const genesisSources = [
  "StaticsGenesis",
  "GenesisVault",
  "GenesisActivationRegistry",
  "GenesisLaunchDistributor",
  "StaticsFeeReceiver",
] as const;

async function configuration() {
  vi.resetModules();
  vi.stubEnv("PONDER_CHAIN_ID", "4663");
  vi.stubEnv("PONDER_POOL_MANAGER_ADDRESS", `0x${"1".repeat(40)}`);
  vi.stubEnv("PONDER_CANONICAL_POOL_ID", `0x${"2".repeat(64)}`);
  vi.stubEnv("PONDER_RPC_URL_4663", "http://127.0.0.1:8663");
  vi.stubEnv("PONDER_DEPLOYMENT_START_BLOCK", "85350967");
  vi.stubEnv("PONDER_POOL_MANAGER_START_BLOCK", "85350966");
  return (await import("../ponder.config")).default;
}
beforeEach(() => {
  for (const name of [
    "PONDER_GENESIS_START_BLOCK",
    "PONDER_STATICS_GENESIS_START_BLOCK",
    "PONDER_GENESIS_VAULT_START_BLOCK",
    "PONDER_GENESIS_ACTIVATION_START_BLOCK",
    "PONDER_GENESIS_DISTRIBUTOR_START_BLOCK",
    "PONDER_STATICS_FEE_RECEIVER_START_BLOCK",
    "PONDER_CANONICAL_LIQUIDITY_START_BLOCK",
  ])
    vi.stubEnv(name, "");
});
afterEach(() => vi.unstubAllEnvs());

describe("inherited history startup boundaries", () => {
  it("backfills Genesis independently of a later Phase 1 deployment", async () => {
    vi.stubEnv("PONDER_GENESIS_START_BLOCK", "47688979");
    const config = await configuration();
    for (const source of genesisSources) expect(config.contracts[source].startBlock).toBe(47688979);
    expect(config.contracts.DexCanonicalPoolManager.startBlock).toBe(47688979);
    expect(config.contracts.PoolManager.startBlock).toBe(85350966);
  });
  it("defaults inherited sources to full history, never the fork or Phase 1 start", async () => {
    const config = await configuration();
    for (const source of genesisSources) expect(config.contracts[source].startBlock).toBe(0);
    expect(config.contracts.DexCanonicalPoolManager.startBlock).toBe(0);
  });
  it("preserves source-specific boundaries and the fork-start swap tape", async () => {
    vi.stubEnv("PONDER_GENESIS_START_BLOCK", "47688979");
    vi.stubEnv("PONDER_GENESIS_VAULT_START_BLOCK", "47690000");
    vi.stubEnv("PONDER_CANONICAL_LIQUIDITY_START_BLOCK", "47690074");
    const config = await configuration();
    expect(config.contracts.GenesisVault.startBlock).toBe(47690000);
    expect(config.contracts.DexCanonicalPoolManager.startBlock).toBe(47690074);
    expect(config.contracts.PoolManager.startBlock).toBe(85350966);
  });
});
