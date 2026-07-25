import { NextResponse } from "next/server";

import { callJupiterTokens } from "@/lib/server/jupiter";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  if (query.length > 120) {
    return NextResponse.json({ error: "Token search is too long." }, { status: 400 });
  }
  const result = await callJupiterTokens(query);
  return NextResponse.json(result.payload, { status: result.status });
}
