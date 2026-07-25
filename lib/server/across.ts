import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const ACROSS_API_BASE = "https://app.across.to/api";
const fallbackConfigPath = path.join(homedir(), ".openclaw", "workspace", ".across");

type AcrossConfig = { apiKey: string; integratorId: string };
export type AcrossResult =
  { ok: true; status: number; payload: unknown } | { ok: false; status: number; payload: unknown };

function parseConfig(text: string) {
  const values = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 0) {
      if (!values.has("ACROSS_API_KEY")) values.set("ACROSS_API_KEY", line);
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key && value) values.set(key, value);
  }
  return values;
}

async function config(): Promise<AcrossConfig> {
  let file = new Map<string, string>();
  try {
    file = parseConfig(await readFile(fallbackConfigPath, "utf8"));
  } catch {
    // The fallback is optional; environment variables remain authoritative.
  }
  const apiKey =
    process.env.ACROSS_API_KEY?.trim() || file.get("ACROSS_API_KEY") || file.get("API_KEY") || "";
  const integratorId =
    process.env.ACROSS_INTEGRATOR_ID?.trim() ||
    file.get("ACROSS_INTEGRATOR_ID") ||
    file.get("INTEGRATOR_ID") ||
    "";
  if (!apiKey || !/^0x[0-9a-fA-F]{4}$/.test(integratorId)) {
    throw new Error("Across API key and 2-byte integrator ID are not configured.");
  }
  return { apiKey, integratorId };
}

async function responsePayload(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: "AcrossApiInvalidJson", detail: text.slice(0, 500) };
  }
}

export async function callAcross(
  pathname: string,
  params: Record<string, string>
): Promise<AcrossResult> {
  let credentials: AcrossConfig;
  try {
    credentials = await config();
  } catch (error) {
    return {
      ok: false,
      status: 503,
      payload: {
        error: "AcrossNotConfigured",
        detail: error instanceof Error ? error.message : "Across is not configured.",
      },
    };
  }
  const url = new URL(`${ACROSS_API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("integratorId", credentials.integratorId);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${credentials.apiKey}`,
      },
      cache: "no-store",
    });
    const payload = await responsePayload(response);
    if (!response.ok || !payload) {
      return {
        ok: false,
        status: response.ok ? 502 : response.status,
        payload: payload ?? { error: "AcrossApiEmptyResponse" },
      };
    }
    return { ok: true, status: response.status, payload };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      payload: {
        error: "AcrossNetworkError",
        detail: error instanceof Error ? error.message : "Could not reach Across.",
      },
    };
  }
}
