import { createHash, timingSafeEqual } from "node:crypto";

type Environment = Record<string, string | undefined>;

type KeyRecord = Readonly<{ id: string; hash: Buffer }>;
type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();
const CAPACITY = 30;
const REFILL_PER_MS = 120 / 60_000;

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function configuredKeys(environment: Environment): readonly KeyRecord[] {
  const raw = environment.STATICS_MARKET_API_KEYS?.trim();
  if (!raw) return [];
  return raw.split(",").map((entry) => {
    const [id, hash, ...extra] = entry.trim().split(":");
    if (
      extra.length ||
      !id ||
      !/^[a-zA-Z0-9-]{1,32}$/.test(id) ||
      !hash ||
      !/^[a-fA-F0-9]{64}$/.test(hash)
    ) {
      throw new Error("STATICS_MARKET_API_KEYS must contain comma-separated id:sha256 entries.");
    }
    return { id, hash: Buffer.from(hash, "hex") };
  });
}

function bearer(request: Request): { id: string; secret: string } | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const match = /^stx_live_([a-zA-Z0-9-]{1,32})_(.{16,})$/.exec(header.slice(7));
  return match ? { id: match[1]!, secret: match[2]! } : null;
}

export type MarketAuthorization =
  | Readonly<{ ok: true; keyId: string }>
  | Readonly<{ ok: false; status: 401 | 429 | 503; retryAfter?: number }>;

export function authorizeMarketRequest(
  request: Request,
  environment: Environment = process.env,
  now = Date.now()
): MarketAuthorization {
  let keys: readonly KeyRecord[];
  try {
    keys = configuredKeys(environment);
  } catch {
    return { ok: false, status: 503 };
  }
  if (!keys.length) return { ok: false, status: 503 };
  const token = bearer(request);
  const record = token ? keys.find((key) => key.id === token.id) : undefined;
  if (!token || !record) return { ok: false, status: 401 };
  const actual = sha256(token.secret);
  if (actual.length !== record.hash.length || !timingSafeEqual(actual, record.hash)) {
    return { ok: false, status: 401 };
  }

  const previous = buckets.get(record.id) ?? { tokens: CAPACITY, updatedAt: now };
  const available = Math.min(
    CAPACITY,
    previous.tokens + (now - previous.updatedAt) * REFILL_PER_MS
  );
  if (available < 1) {
    buckets.set(record.id, { tokens: available, updatedAt: now });
    return { ok: false, status: 429, retryAfter: Math.max(1, Math.ceil((1 - available) / 2)) };
  }
  buckets.set(record.id, { tokens: available - 1, updatedAt: now });
  return { ok: true, keyId: record.id };
}

export function resetMarketRateLimitsForTest(): void {
  buckets.clear();
}
