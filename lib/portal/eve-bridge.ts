import { getAddress, padHex, parseAbi, type Address, type Hex } from "viem";

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

export type EveSendParam = Readonly<{
  dstEid: number;
  to: Hex;
  amountLD: bigint;
  minAmountLD: bigint;
  extraOptions: Hex;
  composeMsg: Hex;
  oftCmd: Hex;
}>;

export const eveOftAbi = parseAbi([
  "function quoteOFT((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) sendParam) view returns ((uint256 minAmountLD, uint256 maxAmountLD) oftLimit, (int256 feeAmountLD, string description)[] oftFeeDetails, (uint256 amountSentLD, uint256 amountReceivedLD) oftReceipt)",
  "function quoteSend((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) sendParam, bool payInLzToken) view returns ((uint256 nativeFee, uint256 lzTokenFee) fee)",
  "function send((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) sendParam, (uint256 nativeFee, uint256 lzTokenFee) fee, address refundAddress) payable returns ((bytes32 guid, uint64 nonce, (uint256 nativeFee, uint256 lzTokenFee) fee) messageReceipt, (uint256 amountSentLD, uint256 amountReceivedLD) oftReceipt)",
  "event OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed fromAddress, uint256 amountSentLD, uint256 amountReceivedLD)",
  "event OFTReceived(bytes32 indexed guid, uint32 srcEid, address indexed toAddress, uint256 amountReceivedLD)",
]);

export const eveTokenApprovalAbi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

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

export function normalizeEveBridgeAmount(amountLD: bigint): bigint {
  return (amountLD / EVE_DECIMAL_CONVERSION_RATE) * EVE_DECIMAL_CONVERSION_RATE;
}

export function createEveSendParam(
  originChainId: number,
  destinationChainId: number,
  recipient: Address,
  amountLD: bigint
): EveSendParam {
  const destination = getEveBridgeDestination(originChainId, destinationChainId);
  if (!destination) throw new Error("This EVE bridge pathway is not configured.");
  const normalizedAmount = normalizeEveBridgeAmount(amountLD);
  if (normalizedAmount === 0n) {
    throw new Error("The minimum bridge amount is 0.000001 EVE.");
  }
  return {
    dstEid: destination.eid,
    to: padHex(recipient, { size: 32 }),
    amountLD: normalizedAmount,
    minAmountLD: normalizedAmount,
    // Both live pathways enforce the reviewed receive option. Supplying it
    // again here would add a second executor charge rather than replacing it.
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  };
}

export function bufferedLayerZeroFee(nativeFee: bigint): bigint {
  return nativeFee + (nativeFee + 4n) / 5n;
}
