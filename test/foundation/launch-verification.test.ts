import { getAddress, type PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const contracts = {
  statics: address("1"),
  genesis: address("2"),
  vault: address("3"),
  activationRegistry: address("4"),
  feeReceiver: address("5"),
  launchDistributor: address("6"),
  weth: address("7"),
  poolManager: address("8"),
  stateView: address("9"),
  quoter: address("a"),
  universalRouter: address("b"),
  permit2: address("c"),
} as const;
const poolInitializer = address("d");
const poolId = `0x${"12".repeat(32)}` as const;
const deployment = {
  kind: "launch",
  descriptor: {
    deploymentId: "launch",
    label: "Genesis",
    network: "Fixture",
    chainId: 4_663,
    stage: "launch",
    capabilities: [],
    available: true,
  },
  deploymentStartBlock: 1n,
  protocolCommit: "fixture",
  source: "development-fixture",
  contracts,
  runtimeCodeHashes: {},
  market: {
    poolId,
    poolKey: {
      currency0: contracts.statics,
      currency1: contracts.weth,
      fee: 10_000,
      tickSpacing: 8,
      hooks: poolInitializer,
    },
  },
} as const satisfies LaunchDeployment;

function client(registryConsumer = contracts.launchDistributor): PublicClient {
  return {
    chain: { id: 4_663 },
    readContract: vi.fn(async ({ address: target, functionName }) => {
      const key = `${target.toLowerCase()}:${String(functionName)}`;
      const values: Record<string, unknown> = {
        [`${contracts.genesis.toLowerCase()}:vault`]: contracts.vault,
        [`${contracts.genesis.toLowerCase()}:activationRegistry`]: contracts.activationRegistry,
        [`${contracts.vault.toLowerCase()}:statics`]: contracts.statics,
        [`${contracts.vault.toLowerCase()}:genesis`]: contracts.genesis,
        [`${contracts.vault.toLowerCase()}:finalized`]: true,
        [`${contracts.activationRegistry.toLowerCase()}:statics`]: contracts.statics,
        [`${contracts.activationRegistry.toLowerCase()}:genesisCollection`]: contracts.genesis,
        [`${contracts.activationRegistry.toLowerCase()}:activeConsumer`]: registryConsumer,
        [`${contracts.feeReceiver.toLowerCase()}:statics`]: contracts.statics,
        [`${contracts.feeReceiver.toLowerCase()}:numeraire`]: contracts.weth,
        [`${contracts.feeReceiver.toLowerCase()}:poolInitializer`]: poolInitializer,
        [`${contracts.feeReceiver.toLowerCase()}:poolId`]: poolId,
        [`${contracts.feeReceiver.toLowerCase()}:activeDistributor`]: contracts.launchDistributor,
        [`${contracts.launchDistributor.toLowerCase()}:feeReceiver`]: contracts.feeReceiver,
        [`${contracts.launchDistributor.toLowerCase()}:genesis`]: contracts.genesis,
        [`${contracts.launchDistributor.toLowerCase()}:activationRegistry`]:
          contracts.activationRegistry,
        [`${contracts.launchDistributor.toLowerCase()}:statics`]: contracts.statics,
        [`${contracts.launchDistributor.toLowerCase()}:numeraire`]: contracts.weth,
        [`${contracts.launchDistributor.toLowerCase()}:vault`]: contracts.vault,
      };
      if (!(key in values)) throw new Error(`Unexpected read ${key}`);
      return values[key];
    }),
  } as unknown as PublicClient;
}

describe("standalone launch verification", () => {
  it("accepts the reviewed permanent-contract bindings", async () => {
    await expect(verifyLaunchDeployment(client(), deployment)).resolves.toBeUndefined();
  });

  it("fails closed when the activation consumer no longer matches", async () => {
    await expect(verifyLaunchDeployment(client(address("f")), deployment)).rejects.toThrow(
      "Registry consumer binding"
    );
  });
});
