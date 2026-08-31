import { getAddress, keccak256, type Address, type PublicClient } from "viem";

import {
  genesisActivationRegistryAbi,
  genesisLaunchDistributorAbi,
  staticsFeeReceiverAbi,
  staticsGenesisAbi,
  staticsGenesisVaultAbi,
} from "@statics-protocol/sdk";

import type { LaunchDeployment } from "@/lib/deployments/types";

const runtimeVerificationCache = new Map<string, Promise<void>>();
const bindingVerificationCache = new Map<string, Promise<void>>();

function same(left: Address, right: Address): boolean {
  return getAddress(left) === getAddress(right);
}

function requireAddress(actual: Address, expected: Address, label: string): void {
  if (!same(actual, expected)) throw new Error(`${label} does not match the reviewed manifest.`);
}

function requireSelectedChain(publicClient: PublicClient, deployment: LaunchDeployment): void {
  if (publicClient.chain && publicClient.chain.id !== deployment.descriptor.chainId) {
    throw new Error("The RPC chain does not match the selected Statics deployment.");
  }
}

async function verifyLaunchRuntimeCode(
  publicClient: PublicClient,
  deployment: LaunchDeployment
): Promise<void> {
  await Promise.all(
    Object.entries(deployment.runtimeCodeHashes).map(async ([name, expected]) => {
      const address = deployment.contracts[name as keyof typeof deployment.contracts];
      const code = await publicClient.getCode({ address });
      if (!code || code === "0x" || keccak256(code).toLowerCase() !== expected!.toLowerCase()) {
        throw new Error(`${name} runtime code does not match the reviewed launch manifest.`);
      }
    })
  );
  if (deployment.analytics) {
    await Promise.all(
      (["treasuryVesting", "reservesLens"] as const).map(async (name) => {
        const contract = deployment.analytics![name];
        const code = await publicClient.getCode({ address: contract.address });
        if (
          !code ||
          code === "0x" ||
          keccak256(code).toLowerCase() !== contract.runtimeCodeHash.toLowerCase()
        ) {
          throw new Error(`${name} runtime code does not match the reviewed launch manifest.`);
        }
      })
    );
  }
}

async function verifyLaunchBindings(
  publicClient: PublicClient,
  deployment: LaunchDeployment
): Promise<void> {
  const [
    genesisVault,
    genesisRegistry,
    vaultStatics,
    vaultGenesis,
    vaultFinalized,
    registryStatics,
    registryGenesis,
    registryConsumer,
    receiverStatics,
    receiverNumeraire,
    receiverInitializer,
    receiverPoolId,
    receiverDistributor,
    distributorReceiver,
    distributorGenesis,
    distributorRegistry,
    distributorStatics,
    distributorNumeraire,
    distributorVault,
  ] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.genesis,
      abi: staticsGenesisAbi,
      functionName: "vault",
    }),
    publicClient.readContract({
      address: deployment.contracts.genesis,
      abi: staticsGenesisAbi,
      functionName: "activationRegistry",
    }),
    publicClient.readContract({
      address: deployment.contracts.vault,
      abi: staticsGenesisVaultAbi,
      functionName: "statics",
    }),
    publicClient.readContract({
      address: deployment.contracts.vault,
      abi: staticsGenesisVaultAbi,
      functionName: "genesis",
    }),
    publicClient.readContract({
      address: deployment.contracts.vault,
      abi: staticsGenesisVaultAbi,
      functionName: "finalized",
    }),
    publicClient.readContract({
      address: deployment.contracts.activationRegistry,
      abi: genesisActivationRegistryAbi,
      functionName: "statics",
    }),
    publicClient.readContract({
      address: deployment.contracts.activationRegistry,
      abi: genesisActivationRegistryAbi,
      functionName: "genesisCollection",
    }),
    publicClient.readContract({
      address: deployment.contracts.activationRegistry,
      abi: genesisActivationRegistryAbi,
      functionName: "activeConsumer",
    }),
    publicClient.readContract({
      address: deployment.contracts.feeReceiver,
      abi: staticsFeeReceiverAbi,
      functionName: "statics",
    }),
    publicClient.readContract({
      address: deployment.contracts.feeReceiver,
      abi: staticsFeeReceiverAbi,
      functionName: "numeraire",
    }),
    publicClient.readContract({
      address: deployment.contracts.feeReceiver,
      abi: staticsFeeReceiverAbi,
      functionName: "poolInitializer",
    }),
    publicClient.readContract({
      address: deployment.contracts.feeReceiver,
      abi: staticsFeeReceiverAbi,
      functionName: "poolId",
    }),
    publicClient.readContract({
      address: deployment.contracts.feeReceiver,
      abi: staticsFeeReceiverAbi,
      functionName: "activeDistributor",
    }),
    publicClient.readContract({
      address: deployment.contracts.launchDistributor,
      abi: genesisLaunchDistributorAbi,
      functionName: "feeReceiver",
    }),
    publicClient.readContract({
      address: deployment.contracts.launchDistributor,
      abi: genesisLaunchDistributorAbi,
      functionName: "genesis",
    }),
    publicClient.readContract({
      address: deployment.contracts.launchDistributor,
      abi: genesisLaunchDistributorAbi,
      functionName: "activationRegistry",
    }),
    publicClient.readContract({
      address: deployment.contracts.launchDistributor,
      abi: genesisLaunchDistributorAbi,
      functionName: "statics",
    }),
    publicClient.readContract({
      address: deployment.contracts.launchDistributor,
      abi: genesisLaunchDistributorAbi,
      functionName: "numeraire",
    }),
    publicClient.readContract({
      address: deployment.contracts.launchDistributor,
      abi: genesisLaunchDistributorAbi,
      functionName: "vault",
    }),
  ]);

  requireAddress(genesisVault, deployment.contracts.vault, "Genesis Vault binding");
  requireAddress(
    genesisRegistry,
    deployment.contracts.activationRegistry,
    "Genesis Registry binding"
  );
  requireAddress(vaultStatics, deployment.contracts.statics, "Vault STATICS binding");
  requireAddress(vaultGenesis, deployment.contracts.genesis, "Vault Genesis binding");
  if (!vaultFinalized) throw new Error("The Genesis Vault launch is not finalized.");
  requireAddress(registryStatics, deployment.contracts.statics, "Registry STATICS binding");
  requireAddress(registryGenesis, deployment.contracts.genesis, "Registry Genesis binding");
  requireAddress(
    registryConsumer,
    deployment.contracts.launchDistributor,
    "Registry consumer binding"
  );
  requireAddress(receiverStatics, deployment.contracts.statics, "Fee Receiver STATICS binding");
  requireAddress(receiverNumeraire, deployment.contracts.weth, "Fee Receiver WETH binding");
  requireAddress(
    receiverInitializer,
    deployment.market.poolKey.hooks,
    "Fee Receiver market binding"
  );
  if (receiverPoolId.toLowerCase() !== deployment.market.poolId.toLowerCase()) {
    throw new Error("Fee Receiver PoolId does not match the reviewed manifest.");
  }
  requireAddress(
    receiverDistributor,
    deployment.contracts.launchDistributor,
    "Fee Receiver distributor binding"
  );
  requireAddress(
    distributorReceiver,
    deployment.contracts.feeReceiver,
    "Distributor Fee Receiver binding"
  );
  requireAddress(distributorGenesis, deployment.contracts.genesis, "Distributor Genesis binding");
  requireAddress(
    distributorRegistry,
    deployment.contracts.activationRegistry,
    "Distributor Registry binding"
  );
  requireAddress(distributorStatics, deployment.contracts.statics, "Distributor STATICS binding");
  requireAddress(distributorNumeraire, deployment.contracts.weth, "Distributor WETH binding");
  requireAddress(distributorVault, deployment.contracts.vault, "Distributor Vault binding");
}

export async function verifyLaunchDeployment(
  publicClient: PublicClient,
  deployment: LaunchDeployment
): Promise<void> {
  requireSelectedChain(publicClient, deployment);
  await verifyLaunchRuntimeCode(publicClient, deployment);
  await verifyLaunchBindings(publicClient, deployment);
}

/**
 * Launch bindings and runtime hashes are immutable for a reviewed deployment.
 * Cache successful verification for the read path, while write paths can keep
 * calling verifyLaunchDeployment directly immediately before a transaction.
 */
export function verifyLaunchDeploymentCached(
  publicClient: PublicClient,
  deployment: LaunchDeployment
): Promise<void> {
  requireSelectedChain(publicClient, deployment);
  const runtimeKey = [
    deployment.descriptor.chainId,
    deployment.protocolCommit,
    ...Object.entries(deployment.runtimeCodeHashes)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, hash]) => {
        const address = deployment.contracts[name as keyof typeof deployment.contracts];
        return `${address.toLowerCase()}:${hash!.toLowerCase()}`;
      }),
  ].join(":");
  let runtime = runtimeVerificationCache.get(runtimeKey);
  if (!runtime) {
    runtime = verifyLaunchRuntimeCode(publicClient, deployment).catch((error) => {
      runtimeVerificationCache.delete(runtimeKey);
      throw error;
    });
    runtimeVerificationCache.set(runtimeKey, runtime);
  }

  const bindingKey = `${deployment.descriptor.deploymentId}:${deployment.descriptor.chainId}:${deployment.protocolCommit}`;
  const existingBindings = bindingVerificationCache.get(bindingKey);
  if (existingBindings) return runtime.then(() => existingBindings);
  const bindings = runtime
    .then(() => verifyLaunchBindings(publicClient, deployment))
    .catch((error) => {
      bindingVerificationCache.delete(bindingKey);
      throw error;
    });
  bindingVerificationCache.set(bindingKey, bindings);
  return bindings;
}
