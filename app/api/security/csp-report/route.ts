import { createHash } from "node:crypto";

const maximumBodyBytes = 16 * 1024;
const maximumReports = 20;
const rateWindowMs = 60_000;
const perClientLimit = 30;
const globalLimit = 600;
const maximumLimiterEntries = 2_000;

type Counter = { windowStartedAt: number; count: number };
type NormalizedReport = Readonly<{
  documentURL?: string;
  blockedURL?: string;
  sourceFile?: string;
  directive?: string;
  effectiveDirective?: string;
  disposition?: string;
  statusCode?: number;
  lineNumber?: number;
  columnNumber?: number;
}>;

const limiterState = globalThis as typeof globalThis & {
  __staticsCspReportLimits?: Map<string, Counter>;
};

function response(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHash("sha256").update(forwarded.slice(0, 128)).digest("hex").slice(0, 16);
}

function incrementWithinLimit(key: string, limit: number, now: number): boolean {
  const limits = (limiterState.__staticsCspReportLimits ??= new Map());
  if (limits.size >= maximumLimiterEntries) {
    for (const [entryKey, counter] of limits) {
      if (now - counter.windowStartedAt >= rateWindowMs) limits.delete(entryKey);
    }
    if (limits.size >= maximumLimiterEntries) return false;
  }
  const counter = limits.get(key);
  if (!counter || now - counter.windowStartedAt >= rateWindowMs) {
    limits.set(key, { windowStartedAt: now, count: 1 });
    return true;
  }
  if (counter.count >= limit) return false;
  counter.count += 1;
  return true;
}

function withinRateLimit(request: Request): boolean {
  const now = Date.now();
  return (
    incrementWithinLimit("global", globalLimit, now) &&
    incrementWithinLimit(`client:${clientKey(request)}`, perClientLimit, now)
  );
}

async function readBoundedBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maximumBodyBytes) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBodyBytes) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

function shortString(value: unknown, maximum = 160): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maximum) : undefined;
}

function safeURL(value: unknown): string | undefined {
  const text = shortString(value, 2_048);
  if (!text) return undefined;
  if (["inline", "eval", "self"].includes(text)) return text;
  if (text.startsWith("data:")) return "data:";
  if (text.startsWith("blob:")) return "blob:";
  try {
    const url = new URL(text);
    if (["chrome-extension:", "moz-extension:", "safari-web-extension:"].includes(url.protocol)) {
      return "browser-extension:";
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return url.protocol;
    return `${url.origin}${url.pathname}`.slice(0, 1_024);
  } catch {
    return undefined;
  }
}

function boundedNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1e9
    ? value
    : undefined;
}

function normalizeBody(body: Record<string, unknown>, fallbackURL?: unknown): NormalizedReport {
  return {
    documentURL: safeURL(body.documentURL ?? body["document-uri"] ?? fallbackURL),
    blockedURL: safeURL(body.blockedURL ?? body["blocked-uri"]),
    sourceFile: safeURL(body.sourceFile ?? body["source-file"]),
    directive: shortString(body.violatedDirective ?? body["violated-directive"]),
    effectiveDirective: shortString(body.effectiveDirective ?? body["effective-directive"]),
    disposition: shortString(body.disposition, 24),
    statusCode: boundedNumber(body.statusCode ?? body["status-code"]),
    lineNumber: boundedNumber(body.lineNumber ?? body["line-number"]),
    columnNumber: boundedNumber(body.columnNumber ?? body["column-number"]),
  };
}

function normalizeReports(payload: unknown): readonly NormalizedReport[] | null {
  if (typeof payload !== "object" || payload === null) return null;
  if (Array.isArray(payload)) {
    if (payload.length > maximumReports) return null;
    return payload.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const report = entry as Record<string, unknown>;
      if (report.type !== "csp-violation" || typeof report.body !== "object" || !report.body) {
        return [];
      }
      return [normalizeBody(report.body as Record<string, unknown>, report.url)];
    });
  }
  const legacy = (payload as Record<string, unknown>)["csp-report"];
  if (typeof legacy !== "object" || legacy === null || Array.isArray(legacy)) return null;
  return [normalizeBody(legacy as Record<string, unknown>)];
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (
    !contentType ||
    !["application/csp-report", "application/reports+json", "application/json"].includes(
      contentType
    )
  ) {
    return response(415);
  }
  if (!withinRateLimit(request)) return response(429);
  const body = await readBoundedBody(request);
  if (body === null) return response(413);
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return response(400);
  }
  const reports = normalizeReports(payload);
  if (!reports || reports.length === 0) return response(400);
  const release = shortString(process.env.STATICS_RELEASE, 80);
  for (const report of reports) {
    console.warn(JSON.stringify({ event: "csp_violation", release, ...report }));
  }
  return response(204);
}

export function resetCspReportLimiterForTests(): void {
  limiterState.__staticsCspReportLimits?.clear();
}
