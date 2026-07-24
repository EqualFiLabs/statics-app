import { chmodSync, readFileSync, writeFileSync } from "node:fs";

const requiredName = "NEXT_PUBLIC_PRIVY_APP_ID";
const optionalName = "NEXT_PUBLIC_PRIVY_CLIENT_ID";
const publicNames = new Set([requiredName, optionalName]);

function parseValue(rawValue) {
  const value = rawValue.trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function readPublicPrivyConfig(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = /^(?:export\s+)?([A-Z0-9_]+)\s*=(.*)$/u.exec(line);
    if (!match || !publicNames.has(match[1])) continue;

    const value = parseValue(match[2]);
    if (value) values[match[1]] = value;
  }

  if (!values[requiredName]) {
    throw new Error(`${requiredName} is missing from the Eves public environment configuration.`);
  }

  return {
    appId: values[requiredName],
    clientId: values[optionalName],
  };
}

export function mergePublicPrivyConfig(contents, config) {
  const replacements = new Map([[requiredName, config.appId]]);
  if (config.clientId) replacements.set(optionalName, config.clientId);

  const output = [];
  const replaced = new Set();

  for (const line of contents ? contents.split(/\r?\n/u) : []) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/u.exec(line);
    const name = match?.[1];

    if (name === optionalName && !config.clientId) continue;
    if (!name || !replacements.has(name)) {
      output.push(line);
      continue;
    }
    if (replaced.has(name)) continue;

    output.push(`${name}=${replacements.get(name)}`);
    replaced.add(name);
  }

  for (const [name, value] of replacements) {
    if (!replaced.has(name)) output.push(`${name}=${value}`);
  }

  return `${output.join("\n").replace(/\n+$/u, "")}\n`;
}

export function importPublicPrivyConfig({ sourcePath, targetPath }) {
  const source = readFileSync(sourcePath, "utf8");
  let target = "";
  try {
    target = readFileSync(targetPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const config = readPublicPrivyConfig(source);
  writeFileSync(targetPath, mergePublicPrivyConfig(target, config), { mode: 0o600 });
  chmodSync(targetPath, 0o600);

  return {
    importedNames: [requiredName, ...(config.clientId ? [optionalName] : [])],
  };
}
