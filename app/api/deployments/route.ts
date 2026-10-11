import { NextResponse } from "next/server";
import { readPublicDeploymentSnapshot } from "@/lib/server/deployment-manifests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, read-only release configuration. Publishing is an operator filesystem action. */
export function GET() {
  try {
    return NextResponse.json(readPublicDeploymentSnapshot(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Public deployment configuration is unavailable." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
