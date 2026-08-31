export type CspMode = "off" | "report-only" | "enforce";
export type CaptchaProvider = "none" | "turnstile" | "hcaptcha";

type SecurityEnvironment = Readonly<Record<string, string | undefined>>;

export type CspConfiguration = Readonly<{
  mode: CspMode;
  captchaProvider: CaptchaProvider;
  privyAuthOrigin: string | null;
  solanaRpcOrigin: string | null;
  development: boolean;
  secureTransport: boolean;
}>;

function oneOf<T extends string>(
  value: string | undefined,
  values: readonly T[],
  label: string,
  fallback: T
): T {
  const selected = value?.trim() || fallback;
  if (!values.includes(selected as T)) throw new Error(`${label} must be ${values.join(", ")}.`);
  return selected as T;
}

function optionalHttpsOrigin(value: string | undefined, label: string): string | null {
  if (!value?.trim()) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTPS origin.`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/") {
    throw new Error(`${label} must be a credential-free HTTPS origin without a path.`);
  }
  return url.origin;
}

function optionalRpcOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL must be an absolute HTTPS URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL must be credential-free HTTPS.");
  }
  return url.origin;
}

export function readCspConfiguration(environment: SecurityEnvironment): CspConfiguration {
  const development = environment.NODE_ENV === "development";
  const production =
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production" ||
    environment.NEXT_PUBLIC_APP_ENV === "production";
  return {
    mode: oneOf(
      environment.STATICS_CSP_MODE,
      ["off", "report-only", "enforce"] as const,
      "STATICS_CSP_MODE",
      production ? "report-only" : "off"
    ),
    captchaProvider: oneOf(
      environment.STATICS_CSP_CAPTCHA_PROVIDER,
      ["none", "turnstile", "hcaptcha"] as const,
      "STATICS_CSP_CAPTCHA_PROVIDER",
      "none"
    ),
    privyAuthOrigin: optionalHttpsOrigin(
      environment.STATICS_PRIVY_AUTH_ORIGIN,
      "STATICS_PRIVY_AUTH_ORIGIN"
    ),
    solanaRpcOrigin: optionalRpcOrigin(environment.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL),
    development,
    secureTransport: production,
  };
}

function directive(name: string, values: readonly string[]): string {
  return `${name} ${[...new Set(values)].join(" ")}`;
}

export function buildContentSecurityPolicy(nonce: string, configuration: CspConfiguration): string {
  if (!/^[A-Za-z0-9+/=_-]+$/.test(nonce)) throw new Error("CSP nonce is invalid.");
  const frameSources = [
    "https://auth.privy.io",
    "https://verify.walletconnect.com",
    "https://verify.walletconnect.org",
  ];
  const connectSources = [
    "'self'",
    "https://auth.privy.io",
    "https://*.rpc.privy.systems",
    "https://explorer-api.walletconnect.com",
    "wss://relay.walletconnect.com",
    "wss://relay.walletconnect.org",
    "wss://www.walletlink.org",
  ];
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  const styleSources = ["'self'", "'unsafe-inline'"];

  if (configuration.development) scriptSources.push("'unsafe-eval'");
  if (configuration.privyAuthOrigin) {
    frameSources.push(configuration.privyAuthOrigin);
    connectSources.push(configuration.privyAuthOrigin);
  }
  if (configuration.solanaRpcOrigin) connectSources.push(configuration.solanaRpcOrigin);
  if (configuration.captchaProvider === "turnstile") {
    frameSources.push("https://challenges.cloudflare.com");
    scriptSources.push("https://challenges.cloudflare.com");
  } else if (configuration.captchaProvider === "hcaptcha") {
    frameSources.push("https://hcaptcha.com", "https://*.hcaptcha.com");
    connectSources.push("https://hcaptcha.com", "https://*.hcaptcha.com");
    scriptSources.push("https://hcaptcha.com", "https://*.hcaptcha.com");
    styleSources.push("https://hcaptcha.com", "https://*.hcaptcha.com");
  }

  const policy = [
    directive("default-src", ["'self'"]),
    directive("script-src", scriptSources),
    directive("style-src", styleSources),
    directive("img-src", ["'self'", "data:", "blob:"]),
    directive("font-src", ["'self'"]),
    directive("connect-src", connectSources),
    directive("child-src", frameSources),
    directive("frame-src", frameSources),
    directive("worker-src", ["'self'", "blob:"]),
    directive("media-src", ["'self'", "blob:"]),
    directive("manifest-src", ["'self'"]),
    directive("object-src", ["'none'"]),
    directive("base-uri", ["'self'"]),
    directive("form-action", ["'self'"]),
    directive("frame-ancestors", ["'none'"]),
    "report-uri /api/security/csp-report",
    "report-to statics-csp",
  ];
  if (configuration.secureTransport) policy.push("upgrade-insecure-requests");
  return `${policy.join("; ")};`;
}

export function cspResponseHeader(mode: CspMode): string | null {
  if (mode === "off") return null;
  return mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}
