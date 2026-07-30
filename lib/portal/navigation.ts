export const PORTAL_MODAL_VALUE = "portal";

export function walletPortalUrl(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.set("modal", PORTAL_MODAL_VALUE);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function withoutWalletPortal(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete("modal");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function portalRequested(search: string): boolean {
  return new URLSearchParams(search).get("modal") === PORTAL_MODAL_VALUE;
}
