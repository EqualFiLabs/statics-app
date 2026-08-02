const ACROSS_API_BASE = "https://app.across.to/api";

type AcrossConfig = { apiKey: string; integratorId: string };
export type AcrossResult =
  { ok: true; status: number; payload: unknown } | { ok: false; status: number; payload: unknown };

export function resolveAcrossConfig(
  environment: Record<string, string | undefined> = process.env
): AcrossConfig {
  const apiKey = environment.ACROSS_API_KEY?.trim() || "";
  const integratorId = environment.ACROSS_INTEGRATOR_ID?.trim() || "";
  if (!apiKey || !/^0x[0-9a-fA-F]{4}$/.test(integratorId)) {
    throw new Error(
      "ACROSS_API_KEY and a 2-byte ACROSS_INTEGRATOR_ID must be configured in the server environment."
    );
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
    credentials = resolveAcrossConfig();
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
