import type { Address } from "viem";

import type {
  ProtocolPermissionDisclosure,
  ProtocolTransactionPresentation,
} from "@/lib/protocol/transactions";

type PermissionInput = Readonly<{
  asset: string;
  spender: Address;
  spenderName: string;
}>;

export function unlimitedTokenPermission(input: PermissionInput): ProtocolPermissionDisclosure {
  return {
    scope: "unlimited-token",
    ...input,
    detail: `Unlimited ${input.asset} spending permission. It remains active until revoked.`,
  };
}

export function maximumPermit2Permission(input: PermissionInput): ProtocolPermissionDisclosure {
  return {
    scope: "maximum-permit2",
    ...input,
    detail: `Maximum Permit2 permission for ${input.asset} with no practical expiry. It remains active until revoked.`,
  };
}

export function erc721OperatorPermission(input: PermissionInput): ProtocolPermissionDisclosure {
  return {
    scope: "erc721-operator",
    ...input,
    detail: `Operator access to every current and future ${input.asset} NFT in this wallet. It remains active until revoked.`,
  };
}

export function erc1155OperatorPermission(input: PermissionInput): ProtocolPermissionDisclosure {
  return {
    scope: "erc1155-operator",
    ...input,
    detail: `Operator access to ${input.asset} across every current and future token ID. It remains active until revoked.`,
  };
}

export function approvalPresentation(
  permission: ProtocolPermissionDisclosure,
  contractName: string
): ProtocolTransactionPresentation {
  return {
    action: `Approve ${permission.asset}`,
    description: `${permission.detail} Spender: ${permission.spenderName} (${permission.spender}). You can revoke it from Approval Tools.`,
    buttonText: `Approve ${permission.asset}`,
    contractName,
    permission,
  };
}

export function actionPresentation(input: {
  action: string;
  description: string;
  contractName: string;
  buttonText?: string;
}): ProtocolTransactionPresentation {
  return {
    action: input.action,
    description: input.description,
    buttonText: input.buttonText ?? input.action,
    contractName: input.contractName,
  };
}
