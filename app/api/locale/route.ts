import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isAppLocale, localeCookieName } from "@/i18n/config";

const oneYearInSeconds = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const locale =
    typeof body === "object" && body !== null && "locale" in body
      ? (body as { locale?: unknown }).locale
      : undefined;
  if (!isAppLocale(locale)) {
    return NextResponse.json({ error: "unsupported_locale" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    httpOnly: true,
    maxAge: oneYearInSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NEXT_PUBLIC_APP_ENV === "production",
  });

  return new NextResponse(null, { status: 204 });
}
