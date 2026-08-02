import { appNavigation } from "@/lib/site-config";

const SOCIAL_IMAGE_PATH = "/assets/robin-hood-hero.png";

export function publicAssetUrl(siteUrl: string | null, path: string): string | null {
  if (!siteUrl) return null;
  return new URL(path, siteUrl).toString();
}

export function socialImageUrl(siteUrl: string | null): string | null {
  return publicAssetUrl(siteUrl, SOCIAL_IMAGE_PATH);
}

export function publicRouteUrls(siteUrl: string | null): string[] {
  if (!siteUrl) return [];

  const paths = new Set([
    "/",
    ...appNavigation.filter((item) => item.enabled).map((item) => item.href),
  ]);

  return [...paths].map((path) => new URL(path, siteUrl).toString());
}
