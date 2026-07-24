import { getAddress } from "viem";

const maximumFunding = 1_000;
const maximumAdvance = 365 * 24 * 60 * 60;

function readOption(arguments_, name) {
  const index = arguments_.indexOf(name);
  if (index === -1) return undefined;
  const value = arguments_[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function decimalAmount(value, name) {
  if (value === undefined) return "0";
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/u.test(value)) {
    throw new Error(`${name} must be a non-negative decimal with at most 18 decimals.`);
  }
  if (Number(value) > maximumFunding) {
    throw new Error(`${name} cannot exceed ${maximumFunding} in one local fixture request.`);
  }
  return value;
}

function unsignedId(value, name) {
  if (!value || !/^\d+$/u.test(value)) {
    throw new Error(`${name} must be a non-negative whole-number identifier.`);
  }
  return value;
}

export function parseLocalControlCommand(action, arguments_) {
  if (action === "status") {
    if (arguments_.length !== 0) throw new Error("local:status does not accept arguments.");
    return { action };
  }

  if (action === "fund-wallet") {
    const address = arguments_[0];
    if (!address || address.startsWith("--")) {
      throw new Error("fund-wallet requires an exact wallet address.");
    }
    const unknown = arguments_.filter(
      (argument, index) =>
        index !== 0 &&
        argument !== "--eth" &&
        argument !== "--weth" &&
        arguments_[index - 1] !== "--eth" &&
        arguments_[index - 1] !== "--weth"
    );
    if (unknown.length) throw new Error(`Unknown fund-wallet argument: ${unknown[0]}.`);
    const eth = decimalAmount(readOption(arguments_, "--eth"), "--eth");
    const weth = decimalAmount(readOption(arguments_, "--weth"), "--weth");
    if (eth === "0" && weth === "0") {
      throw new Error("fund-wallet requires a nonzero --eth or --weth amount.");
    }
    return { action, address: getAddress(address), eth, weth };
  }

  if (action === "advance") {
    if (arguments_.length !== 1 || !/^[1-9]\d*$/u.test(arguments_[0] ?? "")) {
      throw new Error("advance requires one positive whole number of seconds.");
    }
    const seconds = Number(arguments_[0]);
    if (!Number.isSafeInteger(seconds) || seconds > maximumAdvance) {
      throw new Error(`advance cannot exceed ${maximumAdvance} seconds per request.`);
    }
    return { action, seconds };
  }

  if (action === "generate-rewards") {
    const positionId = unsignedId(arguments_[0], "position ID");
    const shares = decimalAmount(readOption(arguments_, "--shares") ?? "0.1", "--shares");
    const allowed =
      arguments_.length === 1 || (arguments_.length === 3 && arguments_[1] === "--shares");
    if (!allowed || shares === "0") {
      throw new Error("generate-rewards accepts a position ID and optional nonzero --shares.");
    }
    return { action, positionId, shares };
  }

  if (action === "generate-lp-fees") {
    const positionId = unsignedId(arguments_[0], "position ID");
    const tokenId = unsignedId(arguments_[1], "LP token ID");
    const amount = decimalAmount(readOption(arguments_, "--amount") ?? "0.000001", "--amount");
    const allowed =
      arguments_.length === 2 || (arguments_.length === 4 && arguments_[2] === "--amount");
    if (!allowed || amount === "0" || Number(amount) > 0.01) {
      throw new Error(
        "generate-lp-fees accepts position and LP token IDs with optional --amount up to 0.01."
      );
    }
    return { action, positionId, tokenId, amount };
  }

  if (action === "seed-recovery") {
    if (arguments_.length !== 1) throw new Error("seed-recovery requires one loan ID.");
    return { action, loanId: unsignedId(arguments_[0], "loan ID") };
  }

  throw new Error(`Unknown local fixture action: ${action || "(missing)"}.`);
}
