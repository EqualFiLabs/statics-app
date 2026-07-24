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

  throw new Error(`Unknown local fixture action: ${action || "(missing)"}.`);
}
