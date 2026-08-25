import { getAddress } from "viem";

export const LAUNCH_FORK_RPC_PORT = 8_545;

const maximumFunding = { eth: 1_000_000, weth: 1_000_000, statics: 10_000_000 };
const maximumAdvanceSeconds = 365 * 24 * 60 * 60;

function readOption(arguments_, name) {
  const index = arguments_.indexOf(name);
  if (index === -1) return undefined;
  const value = arguments_[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

function decimal(value, name, maximum, allowZero = true) {
  if (value === undefined) return "0";
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/u.test(value) || Number(value) > maximum) {
    throw new Error(`${name} must be a decimal no greater than ${maximum}.`);
  }
  if (!allowZero && Number(value) === 0) throw new Error(`${name} must be greater than zero.`);
  return value;
}

export function parseLaunchForkControl(action, arguments_) {
  if (action === "status") {
    if (arguments_.length !== 0) throw new Error("launch-fork:status does not accept arguments.");
    return { action };
  }
  if (action === "advance-time") {
    if (arguments_.length !== 1) {
      throw new Error("advance-time requires exactly one seconds argument.");
    }
    const secondsRaw = arguments_[0];
    if (!/^[1-9]\d*$/u.test(secondsRaw) || Number(secondsRaw) > maximumAdvanceSeconds) {
      throw new Error(
        `advance-time seconds must be an integer from 1 through ${maximumAdvanceSeconds}.`
      );
    }
    return { action, seconds: Number(secondsRaw) };
  }
  if (action === "fund-wallet") {
    const wallet = arguments_[0];
    if (!wallet || wallet.startsWith("--"))
      throw new Error("fund-wallet requires a wallet address.");
    const allowed = new Set(["--eth", "--weth", "--statics"]);
    for (let index = 1; index < arguments_.length; index += 2) {
      if (!allowed.has(arguments_[index]) || arguments_[index + 1] === undefined) {
        throw new Error(`Unknown fund-wallet argument: ${arguments_[index] || "(missing)"}.`);
      }
    }
    for (const option of allowed) {
      if (arguments_.filter((value) => value === option).length > 1) {
        throw new Error(`fund-wallet accepts ${option} only once.`);
      }
    }
    const eth = decimal(readOption(arguments_, "--eth"), "--eth", maximumFunding.eth);
    const weth = decimal(readOption(arguments_, "--weth"), "--weth", maximumFunding.weth);
    const statics = decimal(
      readOption(arguments_, "--statics"),
      "--statics",
      maximumFunding.statics
    );
    if (eth === "0" && weth === "0" && statics === "0") {
      throw new Error("fund-wallet requires a nonzero asset amount.");
    }
    return { action, wallet: getAddress(wallet), eth, weth, statics };
  }
  if (action === "generate-volume") {
    const allowed = new Set(["--eth", "--cycles"]);
    for (let index = 0; index < arguments_.length; index += 2) {
      if (!allowed.has(arguments_[index]) || arguments_[index + 1] === undefined) {
        throw new Error(`Unknown generate-volume argument: ${arguments_[index] || "(missing)"}.`);
      }
    }
    if (
      !arguments_.includes("--eth") ||
      arguments_.filter((value) => value === "--eth").length !== 1
    ) {
      throw new Error("generate-volume requires --eth and optionally --cycles.");
    }
    if (arguments_.filter((value) => value === "--cycles").length > 1) {
      throw new Error("generate-volume accepts --cycles only once.");
    }
    const eth = decimal(readOption(arguments_, "--eth"), "--eth", 1_000_000, false);
    const cyclesRaw = readOption(arguments_, "--cycles") ?? "1";
    if (!/^[1-9]\d*$/u.test(cyclesRaw) || Number(cyclesRaw) > 1_000) {
      throw new Error("--cycles must be an integer from 1 through 1000.");
    }
    return { action, eth, cycles: Number(cyclesRaw) };
  }
  throw new Error(`Unknown launch fork action: ${action || "(missing)"}.`);
}

export function validateLaunchForkCommand(command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    throw new Error("Invalid launch fork command.");
  }
  const keys = Object.keys(command);
  if (typeof command.action !== "string") throw new Error("Invalid launch fork command.");
  const requireKeys = (expected) => {
    if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
      throw new Error(`Invalid ${command.action} command fields.`);
    }
  };
  if (command.action === "status") {
    requireKeys(["action"]);
    return parseLaunchForkControl("status", []);
  }
  if (command.action === "advance-time") {
    requireKeys(["action", "seconds"]);
    return parseLaunchForkControl("advance-time", [String(command.seconds)]);
  }
  if (command.action === "fund-wallet") {
    requireKeys(["action", "wallet", "eth", "weth", "statics"]);
    return parseLaunchForkControl("fund-wallet", [
      command.wallet,
      "--eth",
      command.eth,
      "--weth",
      command.weth,
      "--statics",
      command.statics,
    ]);
  }
  if (command.action === "generate-volume") {
    requireKeys(["action", "eth", "cycles"]);
    return parseLaunchForkControl("generate-volume", [
      "--eth",
      command.eth,
      "--cycles",
      String(command.cycles),
    ]);
  }
  throw new Error(`Unknown launch fork action: ${command.action}.`);
}
