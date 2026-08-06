import { getAddress, type Address } from "viem";

export const EVE_NAME = "0xAgentEVE";
export const EVE_SYMBOL = "EVE";
export const EVE_LOCAL_DECIMALS = 18;
export const EVE_SHARED_DECIMALS = 6;
export const EVE_DECIMAL_CONVERSION_RATE = 10n ** BigInt(EVE_LOCAL_DECIMALS - EVE_SHARED_DECIMALS);

export type EveBridgeDeployment = Readonly<{
  chainId: number;
  eid: number;
  tokenAddress: Address;
  bridgeAddress: Address;
  approvalRequired: boolean;
  peerChainIds: readonly number[];
}>;

export const EVE_BRIDGE_DEPLOYMENTS: readonly EveBridgeDeployment[] = [
  {
    chainId: 8_453,
    eid: 30_184,
    tokenAddress: getAddress("0xe7d192e52fa418236d6eecf7d5eb38da9dd11ba3"),
    bridgeAddress: getAddress("0x160407eFa8556D4CDbf53b543EB36d860ac5a171"),
    approvalRequired: true,
    peerChainIds: [4_663],
  },
  {
    chainId: 4_663,
    eid: 30_416,
    tokenAddress: getAddress("0x12Fa0ec31BE30677Fa38274b3AFBc2A0fCE7648F"),
    bridgeAddress: getAddress("0x12Fa0ec31BE30677Fa38274b3AFBc2A0fCE7648F"),
    approvalRequired: false,
    peerChainIds: [8_453],
  },
] as const;

const deploymentsByChainId = new Map(
  EVE_BRIDGE_DEPLOYMENTS.map((deployment) => [deployment.chainId, deployment])
);

export function getEveBridgeDeployment(chainId: number): EveBridgeDeployment | null {
  return deploymentsByChainId.get(chainId) ?? null;
}

export function isEveToken(chainId: number, address: string | undefined): boolean {
  const deployment = getEveBridgeDeployment(chainId);
  return Boolean(
    deployment && address && deployment.tokenAddress.toLowerCase() === address.toLowerCase()
  );
}

export function getEveBridgeDestination(
  originChainId: number,
  destinationChainId?: number
): EveBridgeDeployment | null {
  const origin = getEveBridgeDeployment(originChainId);
  if (!origin) return null;
  const selectedChainId = destinationChainId ?? origin.peerChainIds[0];
  if (!selectedChainId || !origin.peerChainIds.includes(selectedChainId)) return null;
  return getEveBridgeDeployment(selectedChainId);
}
