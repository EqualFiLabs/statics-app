import { NextResponse } from "next/server";

import { callAcross } from "@/lib/server/across";

export const runtime = "nodejs";

export async function GET() {
  const result = await callAcross("/swap/chains", {});
  return NextResponse.json(result.payload, { status: result.status });
}
