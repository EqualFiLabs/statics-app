import type { AppEnvironment } from "@/lib/site-config";

function previewEnvironment(value: string | undefined): AppEnvironment {
  if (!value) return "development";
  if (value === "development" || value === "staging" || value === "production") return value;
  throw new Error("NEXT_PUBLIC_APP_ENV must be development, staging, or production.");
}

export function readDappPreviewMode(
  environment: Record<string, string | undefined> = process.env
): boolean {
  const appEnvironment = previewEnvironment(environment.NEXT_PUBLIC_APP_ENV);
  const configured = environment.NEXT_PUBLIC_DAPP_PREVIEW;
  if (configured !== undefined && configured !== "true" && configured !== "false") {
    throw new Error("NEXT_PUBLIC_DAPP_PREVIEW must be true or false.");
  }
  if (configured === "true" && appEnvironment !== "development") {
    throw new Error("DApp sample-data preview is available only in development.");
  }
  return configured === undefined ? appEnvironment === "development" : configured === "true";
}

export const dappPreviewEnabled = readDappPreviewMode({
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_DAPP_PREVIEW: process.env.NEXT_PUBLIC_DAPP_PREVIEW,
});
