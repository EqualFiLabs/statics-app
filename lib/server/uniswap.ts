import { getAddress, isAddress } from "viem";

const UNISWAP_API_BASE = "https://trade-api.gateway.uniswap.org/v1";

type ServerEnvironment = Record<string, string | undefined>;

type UniswapApiResult =
  | { ok: true; status: number; payload: unknown }
  | { ok: false; status: number; payload: { errorCode: string; detail: string } | unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function inputChainId(body: unknown): number | null {
  if (!isRecord(body)) return null;
  const direct = body.tokenInChainId ?? body.chainId;
  const value =
    typeof direct === "number"
      ? direct
      : typeof direct === "string" && /^[0-9]+$/.test(direct)
        ? Number(direct)
        : null;
  if (value && Number.isSafeInteger(value)) return value;
  return isRecord(body.quote) ? inputChainId(body.quote) : null;
}

export function getUniswapUniversalRouterVersion(body: unknown): "2.0" | "2.1.1" {
  return inputChainId(body) === 4_663 ? "2.1.1" : "2.0";
}

export async function resolveUniswapApiKey(
  environment: ServerEnvironment = process.env
): Promise<string> {
  const configured = environment.UNISWAP_API_KEY?.trim();
  if (configured) return configured;
  throw new Error("UNISWAP_API_KEY is not configured in the server environment.");
}

export function readUniswapIntegratorFee(environment: ServerEnvironment = process.env): {
  integratorFee?: { recipient: `0x${string}`; bips: number };
} {
  const recipient = environment.UNISWAP_INTEGRATOR_FEE_RECIPIENT?.trim();
  const rawBips = environment.UNISWAP_INTEGRATOR_FEE_BIPS?.trim();
  if (!recipient && !rawBips) return {};
  if (!recipient || !isAddress(recipient) || !rawBips) {
    throw new Error(
      "UNISWAP_INTEGRATOR_FEE_RECIPIENT and UNISWAP_INTEGRATOR_FEE_BIPS must be configured together."
    );
  }
  const bips = Number(rawBips);
  if (!Number.isFinite(bips) || bips <= 0 || bips > 100) {
    throw new Error("UNISWAP_INTEGRATOR_FEE_BIPS must be greater than 0 and at most 100.");
  }
  return { integratorFee: { recipient: getAddress(recipient), bips } };
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { errorCode: "UniswapInvalidResponse", detail: text.slice(0, 500) };
  }
}

export async function callUniswapApi(pathname: string, body: unknown): Promise<UniswapApiResult> {
  let apiKey: string;
  try {
    apiKey = await resolveUniswapApiKey();
  } catch (error) {
    return {
      ok: false,
      status: 503,
      payload: {
        errorCode: "UniswapApiConfigurationError",
        detail: error instanceof Error ? error.message : "Uniswap API is not configured.",
      },
    };
  }

  let response: Response;
  try {
    response = await fetch(`${UNISWAP_API_BASE}${pathname}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": apiKey,
        "x-permit2-disabled": "true",
        "x-universal-router-version": getUniswapUniversalRouterVersion(body),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      payload: {
        errorCode: "UniswapNetworkError",
        detail: error instanceof Error ? error.message : "Could not reach the Uniswap API.",
      },
    };
  }

  const payload = await readPayload(response);
  if (!response.ok || !payload) {
    return {
      ok: false,
      status: response.ok ? 502 : response.status,
      payload: payload ?? {
        errorCode: "UniswapEmptyResponse",
        detail: "Uniswap returned an empty response.",
      },
    };
  }
  return { ok: true, status: response.status, payload };
}
