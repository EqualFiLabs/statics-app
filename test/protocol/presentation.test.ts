import { describe, expect, it } from "vitest";

import {
  approvalPresentation,
  erc1155OperatorPermission,
  erc721OperatorPermission,
  maximumPermit2Permission,
  unlimitedTokenPermission,
} from "@/lib/protocol/presentation";

const spender = "0x0000000000000000000000000000000000000001" as const;

describe("transaction permission presentation", () => {
  it("spells out unlimited token and maximum Permit2 permissions", () => {
    const token = unlimitedTokenPermission({ asset: "TPA1", spender, spenderName: "Permit2" });
    const permit2 = maximumPermit2Permission({
      asset: "TPA1",
      spender,
      spenderName: "PositionManager",
    });

    expect(token.detail).toContain("Unlimited TPA1");
    expect(token.detail).toContain("until revoked");
    expect(permit2.detail).toContain("no practical expiry");
    expect(approvalPresentation(token, "TPA1 token").description).toContain("Approval Tools");
  });

  it("spells out collection-wide operator authority", () => {
    expect(
      erc721OperatorPermission({ asset: "liquidity position", spender, spenderName: "Statics" })
        .detail
    ).toContain("every current and future liquidity position NFT");
    expect(
      erc1155OperatorPermission({ asset: "Risk shares", spender, spenderName: "Dollar Gateway" })
        .detail
    ).toContain("every current and future token ID");
  });
});
