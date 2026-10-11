# Runtime deployment manifests

Public Genesis, Phase 1 and full-protocol manifests can be supplied to the Node server without
rebuilding Next.js. This supports staging the completed app before Phase 1 deployment.
Wallet chains, public Privy identifiers and the public indexer URL still belong to the build
configuration; prepare those stable endpoints and identifiers before building the release.

## Configure the staged server

Set this **server-only** environment variable before starting the staged app:

```text
STATICS_RUNTIME_MANIFEST_PATH=/srv/statics-config/active.json
```

The path must be absolute and readable by the app service. Keep the configuration directory
outside the app's public assets and writable only by the release operator. The app exposes
validated public data through `GET /api/deployments`; it provides no upload/write endpoint.
Never use a broadcast log, private environment file or deployment key file as a manifest.

When the variable is absent, existing checked-in manifests remain the default. When it is set,
the file is authoritative: missing networks remain unavailable. A missing, invalid or oversized
file fails closed; the server does not fall back to older compiled addresses. Each bundle is
limited to 2 MiB. Local development manifests remain development-only and take precedence for
a selected Anvil chain, including a fork sharing Robinhood's chain ID.

## Build a release candidate

The bundle has four fields:

```json
{
  "schemaVersion": 1,
  "launch": {},
  "phaseOne": {},
  "protocol": {}
}
```

`launch` accepts `robinhood-genesis` and `robinhood-testnet-genesis`. `phaseOne` accepts
`robinhood-phase-one` and `robinhood-testnet-phase-one`. `protocol` accepts chain keys `4663`
and `46630`. Values use the existing corresponding manifest schemas and validators.
An empty map deliberately disables that deployment category.

Create a candidate from the checked-in public JSON manifests, adding confirmed deployment output:

```bash
npm run deployment:runtime -- \
  --manifest /path/to/reviewed-robinhood-phase-one.json \
  --output /path/to/releases/phase-one-candidate.json
```

The generator never overwrites an existing output. It assembles public records and prints the
content revision. Full manifest validation happens in the staged application's runtime reader.
For later releases, use `--base /path/to/previous-reviewed-bundle.json` and repeated `--manifest`
arguments to replace individual records while preserving the others. Keep inherited Genesis and
its original deployment boundary in the bundle. Do not substitute the Phase 1 start block.

Run the staged server against the candidate and request `/api/deployments`. Require HTTP 200,
the expected `revision`, `source: "runtime-manifest"` and the exact deployment identities and
addresses. Then perform the relevant launch checks against the confirmed deployment. The endpoint
validates local configuration; it does not prove contracts, permissions or indexer readiness.
Save the reviewed bundle and confirmed deployment provenance in version control separately from
private service configuration.

## Publish without rebuilding or restarting

Prepare the site, private/public RPC routing, Privy origin, indexer service and inherited history
before contract deployment. Once deployment receipts have produced the reviewed public records:

1. Generate and validate the candidate on the staged app.
2. Configure the indexer with the confirmed Phase 1 addresses/start block and await readiness.
3. Copy the validated bundle to a new temporary file in the **same filesystem** as `active.json`.
4. Atomically rename that file over `active.json`. Retain the previous versioned bundle for rollback.
5. Check `/api/deployments` and reload `/app` to confirm the new revision and enabled Phase 1 screens.

A rename replaces the complete release in one operation; never edit the active file in place.
All app processes must read the same published file. A new path or changed process environment
requires restarting the process; changing the contents at the existing path does not.

The app layout is dynamically rendered. It passes one validated snapshot to the browser provider
when `/app` opens. That snapshot stays fixed across internal navigation and transaction review;
existing tabs adopt a new release only on full reload. Server analytics requests pin their own
snapshot across asynchronous reads. Their existing caches are separated by release revision,
including in-flight work, so a previous deployment cannot populate a new release's cache.
The read-only manifest endpoint uses `Cache-Control: no-store`. Do not configure a CDN to cache
this endpoint or `/app` HTML/RSC responses.

Rollback uses the same atomic file replacement with the previous reviewed bundle. This rolls
back app configuration only; it does not undo onchain deployment or transactions.
