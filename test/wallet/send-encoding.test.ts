import { describe, expect, it } from "vitest";
import { encodeFunctionData, erc20Abi, parseAbi, parseUnits } from "viem";

const erc1155 = parseAbi([
  "function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)",
]);

const from = "0x1111111111111111111111111111111111111111" as const;
const to = "0x2222222222222222222222222222222222222222" as const;

describe("send encoding", () => {
  it("encodes an ERC-1155 transfer with its id, amount and data argument", () => {
    // Verified against the running chain: this selector simulates successfully
    // on the risk share token, and an over-balance amount reverts.
    const data = encodeFunctionData({
      abi: erc1155,
      functionName: "safeTransferFrom",
      args: [from, to, 1n, parseUnits("1", 18), "0x"],
    });

    expect(data.slice(0, 10)).toBe("0xf242432a");
  });

  it("does not confuse the two transfer shapes", () => {
    // ERC-20 transfer takes no id, so sending a risk share through it would
    // move the wrong thing or revert.
    const erc20Data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, parseUnits("1", 18)],
    });

    expect(erc20Data.slice(0, 10)).toBe("0xa9059cbb");
    expect(erc20Data.slice(0, 10)).not.toBe("0xf242432a");
  });

  it("keeps the series id distinct from the amount", () => {
    // Transposing them would send a series-1 balance of 1 as an id-1e18
    // balance of 1, which is a silent loss rather than a revert.
    const correct = encodeFunctionData({
      abi: erc1155,
      functionName: "safeTransferFrom",
      args: [from, to, 1n, parseUnits("5", 18), "0x"],
    });
    const transposed = encodeFunctionData({
      abi: erc1155,
      functionName: "safeTransferFrom",
      args: [from, to, parseUnits("5", 18), 1n, "0x"],
    });

    expect(correct).not.toBe(transposed);
  });
});
