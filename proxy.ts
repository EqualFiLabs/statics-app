import { NextRequest, NextResponse } from "next/server";

import {
  buildContentSecurityPolicy,
  cspResponseHeader,
  readCspConfiguration,
} from "@/lib/security/csp";

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes));
}

export function proxy(request: NextRequest) {
  const configuration = readCspConfiguration(process.env);
  const responseHeader = cspResponseHeader(configuration.mode);
  if (!responseHeader) return NextResponse.next();

  const nonce = createNonce();
  const policy = buildContentSecurityPolicy(nonce, configuration);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the enforcement header on the internal request to attach the
  // nonce to framework scripts. The browser receives only the selected mode.
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(responseHeader, policy);
  response.headers.set("Reporting-Endpoints", 'statics-csp="/api/security/csp-report"');
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|assets|icons|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
