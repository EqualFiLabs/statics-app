const JUPITER_ORDER_API = "https://api.jup.ag/swap/v2/order";
const JUPITER_EXECUTE_API = "https://api.jup.ag/swap/v2/execute";

export const DEFAULT_JUPITER_SLIPPAGE_BPS = 50;

type JupiterResult =
  { ok: true; status: number; payload: unknown } | { ok: false; status: number; payload: unknown };

async function payload(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { detail: text.slice(0, 500) };
  }
}

function headers(contentType = false) {
  const apiKey = process.env.JUPITER_API_KEY?.trim();
  return {
    accept: "application/json",
    ...(contentType ? { "content-type": "application/json" } : {}),
    ...(apiKey ? { "x-api-key": apiKey } : {}),
  };
}

export async function callJupiterOrder(input: {
  inputMint: string;
  outputMint: string;
  amount: string;
  taker?: string;
  slippageBps?: number;
}): Promise<JupiterResult> {
  const url = new URL(JUPITER_ORDER_API);
  url.searchParams.set("inputMint", input.inputMint);
  url.searchParams.set("outputMint", input.outputMint);
  url.searchParams.set("amount", input.amount);
  url.searchParams.set("slippageBps", String(input.slippageBps ?? DEFAULT_JUPITER_SLIPPAGE_BPS));
  if (input.taker) url.searchParams.set("taker", input.taker);
  try {
    const response = await fetch(url, { headers: headers(), cache: "no-store" });
    const body = await payload(response);
    return response.ok && body
      ? { ok: true, status: response.status, payload: body }
      : {
          ok: false,
          status: response.ok ? 502 : response.status,
          payload: body ?? { detail: "Jupiter returned an empty response." },
        };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      payload: {
        detail: error instanceof Error ? error.message : "Could not reach Jupiter.",
      },
    };
  }
}

export async function callJupiterExecute(input: {
  signedTransaction: string;
  requestId: string;
  lastValidBlockHeight?: string;
}): Promise<JupiterResult> {
  try {
    const response = await fetch(JUPITER_EXECUTE_API, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify(input),
      cache: "no-store",
    });
    const body = await payload(response);
    return response.ok && body
      ? { ok: true, status: response.status, payload: body }
      : {
          ok: false,
          status: response.ok ? 502 : response.status,
          payload: body ?? { detail: "Jupiter returned an empty response." },
        };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      payload: {
        detail: error instanceof Error ? error.message : "Could not reach Jupiter.",
      },
    };
  }
}
