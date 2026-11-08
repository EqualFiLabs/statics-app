# Shared EqualFi agent pilot

The feature-gated `/app/agent` screen uses `@equalfi/agent-client` through a same-origin server BFF. The service owns preparation, grants, budgets, signing/submission and recovery. Statics owns wallet interaction and protocol-query reconciliation. This implements the first Statics capability from [#91](https://github.com/EqualFiLabs/statics-app/issues/91); Eves remains a later client.

## Configuration

`NEXT_PUBLIC_AGENT_ENABLED` defaults to false. When enabled, configure server-only `AGENT_SERVICE_URL` (HTTPS or local loopback HTTP) and `AGENT_APP_CONNECTION_KEY`; register the matching Statics connection in the service. Use the same Privy application as the existing app. The BFF forwards the verified-user token and selected wallet to the service, forces its own `statics` app identity and never accepts a browser-supplied app credential. The server must review deployment provenance matching the app's exact deployment ID/chain. This repository does not configure/enable a production worker or create a pilot grant.

Only existing-position staking moves through the shared path when enabled. The Earn stake form passes its exact position and amount to the canonical proposal screen; `usePhaseOneAction` rejects independent `phase-one-stake` broadcasting in this mode. Position creation and other capabilities keep their existing behavior. Do not revert to another broadcaster until shared in-flight actions have drained or remain explicitly recoverable.

## User flow

Sign in, select the configured network, enter an explicit owned position, STATICS amount and ETH network-fee cap. Prepare a proposal and review its exact approval/stake steps. Execution requires global wallet limits. Manual signing uses the persisted exact transaction and nonce and returns signed bytes to the shared executor. Embedded wallets use Privy's sign-only UI; external wallets must support `eth_signTransaction`. An unsupported wallet fails visibly before submission; it never falls back to a second broadcaster.

Embedded-wallet delegation additionally installs the configured provider signer/policy and creates an explicit Statics grant with allowed positions, principal/fee limits, approval permission and expiry. These are separate actions. Global pause stops new execution across connected apps; Statics revoke removes only this app's authority. The wallet-signers removal control pauses first, revokes Statics, then removes all Privy signers (the control states its wallet-wide scope).

Activity is owned by the server, refreshed on reconnect and shown with each step, hash, pending state and verified outcome. An unresolved receipt is not presented as failure or success. Stop-future-steps cannot undo already submitted transactions. Confirmed attempts feed the existing protocol query reconciler. Persisted client intent keys prevent retries from creating duplicate actions; a new explicit request after a completed action gets a new intent key.

Conversation messages are stored server-side by user/app; the browser retains only the selected conversation pointer and outstanding request keys. Chat may prepare an action or use an existing eligible grant. Research citations, usage caps and action results come from the shared service. Private pilot panel copy is English; navigation/handoff labels exist in all supported locales. Values use explicit STATICS/ETH units; this screen does not estimate USD prices.

## Validation and enablement

Run focused `test/agent` tests plus existing staking/reconciliation tests, typecheck and lint. Existing CI owns the complete app/ponder gates. A real browser + Privy manual/delegated rehearsal is required before enabling execution; mocked component tests and a local fork signer do not prove it. Keep the worker execution and provider-rehearsal gates disabled until the service runbook's deployment, credentials, budgets, backup/restore, provider and model/research checks pass.

The pinned SDK archive is documented in `vendor/equalfi-agent-client/PROVENANCE.md`. Service source lives in the sibling `equalfi-agent` implementation workspace; publish it to a human-initialized repository/default base before considering this a remotely reproducible release candidate.
