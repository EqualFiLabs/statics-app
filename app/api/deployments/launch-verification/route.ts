import { launchManifestIdentity } from "@/lib/deployments/launch-identity";
import { NextResponse } from "next/server";

import { serverDeploymentRegistry } from "@/lib/server/deployment-manifests";
import { verifyLaunchDeploymentOnServer } from "@/lib/server/launch-verification";

export const runtime = "nodejs";

type VerificationRequest = Readonly<{
  chainId?: unknown;
  deploymentId?: unknown;
  manifestIdentity?: unknown;
}>;

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: "Cross-origin deployment verification is not allowed." },
      { status: 403 }
    );
  }

  let payload: VerificationRequest;
  try {
    payload = (await request.json()) as VerificationRequest;
  } catch {
    return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
  }
  if (!Number.isSafeInteger(payload.chainId) || typeof payload.deploymentId !== "string") {
    return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
  }

  let options;
  try {
    options = serverDeploymentRegistry();
  } catch {
    return NextResponse.json(
      { error: "Public deployment configuration is unavailable." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
  const deployment = options
    .map((option) => option.launch)
    .find(
      (launch) =>
        launch?.descriptor.deploymentId === payload.deploymentId &&
        launch?.descriptor.chainId === payload.chainId
    );
  if (!deployment || deployment.source === "development-fixture") {
    return NextResponse.json({ error: "Unknown launch deployment." }, { status: 404 });
  }

  if (
    (deployment.source === "runtime-manifest" || payload.manifestIdentity !== undefined) &&
    payload.manifestIdentity !== launchManifestIdentity(deployment)
  ) {
    return NextResponse.json(
      { error: "The deployment configuration changed. Reload the app." },
      {
        status: 409,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const verification = verifyLaunchDeploymentOnServer(deployment);
  try {
    await verification.verification;
    return NextResponse.json(
      {
        chainId: deployment.descriptor.chainId,
        deploymentId: deployment.descriptor.deploymentId,
        verified: true,
      },
      {
        headers: {
          "cache-control": "no-store",
          "x-statics-verification-cache": verification.status,
        },
      }
    );
  } catch (error) {
    console.warn("Launch deployment verification failed", {
      chainId: deployment.descriptor.chainId,
      deploymentId: deployment.descriptor.deploymentId,
      error: error instanceof Error ? error.message : "Unknown verification failure",
    });
    return NextResponse.json(
      { error: "Launch deployment verification failed." },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
          "x-statics-verification-cache": verification.status,
        },
      }
    );
  }
}
