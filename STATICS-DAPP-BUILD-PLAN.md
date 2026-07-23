# Statics Site and DApp Build Plan

- Last updated: 2026-07-22
- Status: Phase 1 complete; shared wallet foundation not started
- Primary workspace: `statics-site`
- Protocol source: `../statics`
- Reference wallet implementation: `../market-ui/eves-market-ui`

## Purpose

This is the living source of truth for the Statics website and DApp build. It records what we are building, why the architecture was chosen, the security boundaries we must preserve, and the evidence required before a phase is considered complete.

Update this document as work progresses. A checked item must link to or name the code, test, deployment record, or review that proves it is complete. Do not mark deployment or live-network work complete from local tests alone.

### Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Implemented and locally verified
- `[!]` Blocked; explain the blocker beside the item
- `[-]` Deferred or intentionally out of scope

## Product outcome

Build one Statics web product with two deliberately separated runtime surfaces:

- `/` is the public landing page. It preserves the current visual design, copy, Statics branding, and Robin Hood artwork. It does not load wallet SDKs.
- `/app` is the authenticated Statics DApp. It uses the same Privy user and embedded EVM wallet as Eves Market, while retaining Statics-specific delegated authority and server records.

The first useful release is Dollar-first: a user signs in, sees the same wallet used by Eves Market, obtains or redeems Statics Dollar through a clear reviewed action, and then sees that same onchain Statics Dollar balance in Eves Market. Later releases add the broader basket, PositionNFT, lending, rewards, and canonical-liquidity surfaces already exposed by the Statics protocol.

## Current state

- The approved landing page is served at `/` by Next.js 16 and React 19, with its copy, responsive visual system, Statics branding, and Robin Hood hero preserved.
- A branded, read-only DApp foundation is served at `/app`. It reports the wallet, network, and deployment as unavailable instead of fabricating connected or live state.
- Final brand assets live in `public/assets/`; `mockup.png` remains the design reference.
- Vitest component/foundation tests and Playwright desktop, tablet, and mobile checks cover the landing, DApp shell, accessibility, route behavior, security headers, and visual snapshots.
- There is no wallet connection, delegated authority, API layer, database, contract configuration, or public deployment configuration in this repository yet.
- The live protocol source is maintained separately in `../statics`.
- The protocol repository records no public Statics deployment. The DApp must not show a production address, live TVL, or “deployed” status until a verified deployment manifest exists.
- Eves Market already treats Statics Dollar as its default collateral/trading asset and contains a working Privy/Wagmi and delegated-signing reference implementation.

## Architecture decisions

| Area                         | Decision                                                                                                                            | Reason                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Application framework        | Convert this repository to Next.js with TypeScript                                                                                  | Delegated signing needs protected server routes, server-only credentials, and durable authorization. A Vite-only application would require a second backend. |
| Product boundary             | Keep Statics as a separate deployable application                                                                                   | Statics and Eves have distinct product UX, releases, server authority, and failure domains.                                                                  |
| Landing and DApp             | Keep both in this Next.js application                                                                                               | The landing can remain static while `/app` owns wallet and onchain runtime concerns.                                                                         |
| Wallet identity              | Plan to reuse the same Privy App ID and user-owned embedded EVM wallet as Eves Market, subject to Privy dashboard/domain validation | The user should have one address and one onchain balance across both products.                                                                               |
| Session experience           | Prefer sibling subdomains under one verified parent domain                                                                          | Same wallet identity is guaranteed by Privy configuration; shared-domain hosting gives the best chance of seamless session continuity.                       |
| Provider order               | `QueryClientProvider -> PrivyProvider -> Statics wallet bridge -> @privy-io/wagmi WagmiProvider -> DApp UI`                         | Wallet-dependent children must never render before Privy and Wagmi exist.                                                                                    |
| Landing runtime              | Do not initialize Privy/Wagmi on `/`                                                                                                | Keeps the marketing page fast and prevents wallet-provider regressions from breaking the public site.                                                        |
| Delegated authority          | Attach a new Statics-specific signer and policies to the shared wallet                                                              | Sharing a wallet must not mean sharing Eve's authorization key, policies, or blast radius.                                                                   |
| Permission storage           | Create Statics-specific durable delegation and operation records                                                                    | Eve and Statics permissions must be independently auditable and revocable.                                                                                   |
| External wallets             | Preserve ordinary wallet confirmation                                                                                               | Server-side one-click signing is only for the authenticated, exact embedded wallet that has an active Statics grant.                                         |
| Manual vs autonomous actions | Keep them as separate grants                                                                                                        | Enabling a one-click user-requested action must not silently enable autonomous actions.                                                                      |
| Contract integration         | Use the unified `StaticsDiamond` for ordinary user actions and canonical protocol ABIs/SDK artifacts                                | The protocol intentionally exposes a single normal integration address.                                                                                      |
| Transaction safety           | Typed actions only; exact approvals; fresh onchain previews; simulation; receipt verification                                       | The server must never accept arbitrary calldata or an arbitrary transaction target.                                                                          |

## Wallet and identity model

### Shared between Statics and Eves

- Privy App ID and authenticated Privy user identity.
- User-owned embedded EVM wallet and active wallet address.
- Supported-chain definitions where both products use the same network.
- Common account-selection rules so stale Wagmi connections cannot override the active Privy wallet.
- Access-token verification rules and exact-wallet ownership checks.

### Separate for Statics

- `PRIVY_STATICS_SIGNER_ID`.
- Statics authorization private key stored only on the server.
- Statics policy IDs restricted to approved chain, Diamond address, selectors, and value ceilings.
- Statics delegation database row and status.
- Statics action idempotency and activity records.
- Statics capability settings and revocation lifecycle.

Eve's signer ID, authorization private key, policy set, and `agent_delegations` record must never be copied or reused as Statics authority.

### One-click Statics flow

1. The user signs in with Privy or connects an external wallet.
2. Privy reuses or creates the user's embedded EVM wallet.
3. The user explicitly enables “Statics Actions.”
4. The client requests installation of the Statics signer with the reviewed policy IDs.
5. The Statics server verifies the access token, Privy user, exact wallet, signer attachment, and expected policies.
6. The server creates an active Statics delegation record.
7. For each supported action, the UI shows the current quote, fees, amounts, target network, and expected result before the user clicks.
8. The server rebuilds the typed action from fresh state, simulates it, claims an idempotency key, signs through Privy, broadcasts, waits for the receipt, and records the result.
9. External wallets take the same reviewed action through their normal wallet confirmation instead of the delegated route.

“One click” means one deliberate DApp action without an extra wallet popup. It does not mean invisible transactions, hidden approvals, stale quotes, or unrestricted automation.

### Revocation requirements

- Revocation is idempotent and safe to retry.
- The server record is revoked even if the client loses local state.
- The Privy signer is removed or disabled.
- Every server response is checked; partial failure is shown clearly and retried.
- New actions are denied as soon as either the durable grant or signer verification fails.
- Any future autonomous process revalidates authority before every value-moving action and stops on revocation.

## DApp information architecture

Proposed routes may change during UX design, but the product capabilities should remain grouped as follows:

| Route               | User outcome                                                                                                       | Initial release  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `/app`              | Portfolio overview, wallet, network, Statics Dollar balance, positions, pending rewards, and protocol status       | Yes              |
| `/app/dollar`       | Deposit ETH/WETH, obtain Statics Dollar and Risk Shares, recombine to ETH/WETH, and use configured pegged profiles | Yes              |
| `/app/activity`     | Pending, confirmed, failed, and replaced Statics actions with explorer links                                       | Yes              |
| `/app/settings`     | Wallet information, Statics Actions grant, limits, export guidance, and revocation                                 | Yes              |
| `/app/baskets`      | Discover and inspect permissionless baskets and their lifecycle/risk metadata                                      | Next release     |
| `/app/baskets/[id]` | Quote, mint, redeem, and inspect constituent requirements and fees                                                 | Next release     |
| `/app/create`       | Create a permissionless basket with validated configuration and creation fee                                       | Later release    |
| `/app/positions`    | Inspect and manage PositionNFT legs, staking, basket collateral, Dollar legs, and transfer consequences            | Later release    |
| `/app/loans`        | Quote, borrow, repay, extend, and inspect recovery state per independent loan tranche                              | Later release    |
| `/app/rewards`      | Global staking, activation/cooldown, multi-asset pending rewards, and claims                                       | Later release    |
| `/app/liquidity`    | Canonical pool state, user v4 positions, staking, activation, claims, and exits                                    | Advanced release |
| `/app/protocol`     | Read-only health, custody, lifecycle, timelock, and deployed-address information                                   | Yes, read-only   |

## User-facing protocol requirements

### Statics Dollar release

- [ ] Display active wallet and network with no stale-address fallback.
- [ ] Display Statics Dollar, WETH/ETH, configured pegged collateral, and Risk Share balances.
- [ ] Read profile configuration, debt ceilings, health state, exit availability, and current fees.
- [ ] Support typed ETH and WETH deposits through `StaticsDiamond`.
- [ ] Support ordinary recombination to WETH or ETH.
- [ ] Support EIP-2612 permit recombination when available.
- [ ] Support configured pegged-profile mint and redemption with authoritative onchain previews.
- [ ] Keep Risk Share ERC-1155 operator approval separate and clearly explained.
- [ ] Disable actions when profile health, sequencer, debt ceiling, pause, or exit state forbids them.
- [ ] Refresh the shared wallet balance after confirmation so Eves Market can immediately observe the same onchain collateral.

### Basket release

- [ ] Discover baskets from indexed creation/configuration events and reconcile them with current onchain state.
- [ ] Show one-to-sixteen constituents, bundle amounts, lifecycle, fee tiers, LTV, loan duration, and token-risk warnings.
- [ ] Quote mint/redeem immediately before submission.
- [ ] Present constituent approvals sequentially and use exact/bounded amounts.
- [ ] Apply receiver-side minimum outputs and caller-selected slippage limits.
- [ ] Do not imply that holding BasketTokens earns basket-specific fees.

### Positions, lending, and rewards release

- [ ] Create and inspect PositionNFTs.
- [ ] Explain that transferring a PositionNFT transfers every attached protocol leg and obligation.
- [ ] Support global staking, cooldown state, pending multi-asset rewards, and claims.
- [ ] Support basket collateral deposits, direct mint-to-collateral, withdrawals, and redemptions.
- [ ] Show each loan as an independent tranche with principal vector, maturity, and recovery time.
- [ ] Support borrow, repay, and extend using fresh authoritative quotes.
- [ ] Block position closure while any leg remains live.

### Canonical liquidity release

- [ ] Show zero native v4 LP fee separately from bilateral Statics hook fees.
- [ ] Show pool lifecycle, warm-up, observation state, manager sync, fee allocation, pending POL, and locked POL.
- [ ] Support user-owned PositionManager NFT creation and discovery.
- [ ] Support staking, next-block activation, increase, claim, and immediate unstake for qualifying full-range LP NFTs.
- [ ] Clearly distinguish hook-owned permanent liquidity from user-owned LP NFTs.

## Transaction UX rules

Every value-moving workflow must expose one valid next action at a time:

1. Switch network, if the wallet is on the wrong chain.
2. Approve or sign an exact permit, if authorization is insufficient.
3. Execute the reviewed protocol action.

For every action:

- Show human-readable input and output amounts, fees, slippage bounds, network, and contract target.
- Keep the last known good quote visible while refreshing and label it as refreshing.
- Disable duplicate submissions while an operation is pending.
- Simulate immediately before signing or delegated broadcasting.
- Use a durable idempotency key for server-broadcast actions.
- Wait for a confirmed receipt and detect reverted or replaced transactions.
- Show plain-language errors without discarding the technical cause from logs.
- Never use an unlimited token approval by default.

## Server and data design

Minimum server-owned records:

### `statics_delegations`

- Privy user ID
- exact lowercase EVM wallet address
- Statics signer ID and policy version
- manual one-click enabled flag
- separately scoped autonomous capability flags, initially all false
- per-action/value limits and optional expiry
- active/revoked status
- created, updated, and revoked timestamps

### `statics_operations`

- operation and idempotency IDs
- Privy user and wallet
- chain ID
- typed action kind
- reviewed input/quote fingerprint
- transaction hash
- lifecycle state: prepared, simulated, broadcast, confirmed, reverted, replaced, or failed
- structured failure code and timestamps

Initial protected endpoints:

- `GET/PATCH/DELETE /api/statics/delegation`
- `POST /api/statics/actions/dollar/deposit`
- `POST /api/statics/actions/dollar/recombine`
- `POST /api/statics/actions/dollar/pegged-mint`
- `POST /api/statics/actions/dollar/pegged-redeem`
- `GET /api/statics/operations/[id]`

Each action endpoint must authenticate Privy, prove exact wallet ownership, prove active Statics delegation, rebuild the action from accepted typed fields, enforce policy/value limits, simulate, and record the complete lifecycle. No endpoint accepts raw target addresses or arbitrary calldata from the browser.

## Configuration and secret boundary

Public configuration may include:

- Privy App ID and client ID
- Statics signer ID
- public policy IDs
- supported chain ID
- public RPC URL without embedded credentials
- verified contract addresses and deployment metadata

Server-only configuration includes:

- Privy App Secret
- Statics authorization private key
- private RPC/API credentials
- database URL and credentials
- rate-limit and monitoring credentials

Required safeguards:

- [x] `.env*`, private keys, credentials, build output, and local databases are ignored (`.gitignore`).
- [ ] Production startup fails closed when Privy, signer, chain, database, or contract configuration is missing.
- [ ] Contract addresses come from a verified deployment manifest, never placeholders or memory.
- [ ] No server secret uses a `NEXT_PUBLIC_` prefix.
- [ ] Logs redact access tokens, signatures, authorization headers, and private RPC URLs.

## Delivery phases and gates

### Foundation and landing migration

- [x] Scaffold Next.js 16, React 19, TypeScript, linting, formatting, and tests in this repository (`package.json`).
- [x] Port the current landing page pixel-faithfully while replacing simulated live data with approved pre-launch copy (`app/(marketing)`, `components/landing`).
- [x] Preserve responsive behavior, accessibility, metadata, and the Robin Hood artwork (`app/layout.tsx`, Playwright snapshots and accessibility checks).
- [x] Add route separation so `/` does not load wallet code (`app/(marketing)`, `app/(dapp)`, wallet-runtime regression test).
- [x] Add a real `/app` launch destination and render unavailable external destinations as visible, inert placeholders.
- [x] Add public environment validation and safe route/global production error screens (`lib/site-config.ts`, `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`).

Gate: landing visual comparison passes at desktop and mobile sizes; production build succeeds; no wallet bundle/runtime is initialized on `/`.

Evidence (2026-07-22): `npm run verify` passed lint, formatting, TypeScript, 8 Vitest tests, a Next.js 16 production build, and 21 Playwright tests across desktop, tablet, and mobile projects. Six reviewed visual snapshots cover `/` and `/app`; automated checks also cover accessibility, reduced motion, keyboard navigation, responsive overflow, security headers, inert placeholders, and the absence of wallet dependencies/runtime. `npm audit` reported zero vulnerabilities.

### Shared wallet foundation

- [ ] Add the approved Privy, Wagmi, Viem, and React Query versions.
- [ ] Implement the strict provider hierarchy.
- [ ] Reuse the approved Privy App ID and configure both product origins.
- [ ] Implement active-account selection and embedded/external wallet detection.
- [ ] Add sign-in, embedded-wallet creation/reuse, logout, chain switching, and wallet export guidance.
- [ ] Prove that the same Privy user resolves to the same EVM address in Statics and Eves.

Gate: provider-order regression tests pass; missing configuration fails closed in production; embedded and external wallet journeys both pass.

### Statics Actions delegation

- [ ] Create a dedicated Statics signer, authorization key, and restrictive policies.
- [ ] Implement enable, server verification, durable persistence, status hydration, and revocation.
- [ ] Verify signer and policy attachment on the server before activating the grant.
- [ ] Keep manual one-click permission separate from autonomous capabilities.
- [ ] Implement typed, idempotent server execution infrastructure.
- [ ] Add rate limiting and structured activity records.

Gate: tests cover exact-wallet mismatch, wrong user, wrong chain, missing signer, wrong policy, expired/revoked grant, partial enable, partial revoke, duplicate submission, simulation failure, reverted receipt, and external-wallet fallback.

### Statics Dollar DApp

- [ ] Implement the Dollar dashboard and authoritative protocol reads.
- [ ] Implement the reviewed manual wallet-confirmed flows.
- [ ] Implement equivalent one-click routes for the approved embedded-wallet actions.
- [ ] Add exact approval/permit sequencing and receipt-confirmed activity.
- [ ] Add the Eves Market handoff/deep link without transferring custody or duplicating balances.

Gate: every value-moving flow passes on a local fork/rehearsal using real contracts and real approvals; unit mocks alone do not satisfy this gate.

### Broader protocol DApp

- [ ] Basket discovery, details, mint, and redemption.
- [ ] PositionNFT, basket collateral, and global staking.
- [ ] Loan quote, borrow, repay, extend, maturity, and recovery displays.
- [ ] Multi-asset reward claims.
- [ ] Permissionless basket creation.
- [ ] Canonical v4 liquidity and user LP NFT management.

Gate: each lifecycle has focused unit coverage plus at least one real local integration flow. Current onchain state remains authoritative over cached/indexed data.

### Live-network readiness

- [ ] Record the authorized target network and verified deployment manifest.
- [ ] Validate every address, bytecode binding, chain ID, and supported action selector.
- [ ] Run full typecheck, lint, unit, component, integration, and production-build gates.
- [ ] Complete security review of auth, policies, delegated broadcaster, transaction construction, and secret handling.
- [ ] Test the complete UI locally against the live network with read-only calls.
- [ ] Obtain explicit authorization before any public-testnet or value-moving live action.
- [ ] Execute small-value authorized smoke flows and preserve transaction evidence.

Gate: verified contracts, authorized receipts, no unresolved high-severity findings, no leaked secrets, and documented rollback/revocation procedures.

### Production release

- [ ] Configure verified production domains, allowed origins, cookie settings, RPCs, database, monitoring, and rate limits.
- [ ] Publish final title, description, favicon, OG image, documentation, terms, privacy, and security links.
- [ ] Verify mobile, keyboard, screen-reader, and reduced-motion behavior.
- [ ] Confirm no placeholder TVL, block height, deployment status, addresses, or unsupported actions remain.
- [ ] Confirm wallet sign-in, network switching, reads, manual actions, delegated actions, revocation, and Eves balance continuity.
- [ ] Document incident response and emergency delegated-signer disable procedure.

Gate: production QA checklist is signed off with URLs and evidence. A production bug returns to the previous validated phase; it is not patched around by weakening a security invariant.

## Verification matrix

| Layer                 | Required evidence                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Landing               | Visual screenshots, responsive checks, accessibility checks, production build                                  |
| Provider boundary     | Source/behavior tests proving Wagmi remains under Privy and children never render during a provider gap        |
| Identity              | Same Privy user and exact embedded address demonstrated in both products                                       |
| Manual wallet actions | Simulation, wallet confirmation, receipt, balance refresh, and clear rejection handling                        |
| Delegated actions     | Exact-user/wallet/policy tests, typed action reconstruction, idempotency, receipt verification, and revocation |
| Protocol integration  | Focused contract/SDK tests plus local full-flow tests using real protocol deployments                          |
| Live network          | Explicit authorization, small-value receipts, verified addresses, and explorer evidence                        |
| Production            | Typecheck, tests, build, secret scan, monitoring, domain configuration, and end-to-end QA                      |

## Known risks and mitigations

| Risk                                                              | Mitigation                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Same wallet is mistaken for shared authority                      | Use independent Statics signer, policies, records, limits, and revocation.                        |
| Wallet children render before providers                           | Route-split runtime and regression tests for the strict provider tree.                            |
| Client claims a delegation that Privy does not actually hold      | Server verifies signer and policy attachment before persisting active state.                      |
| Partial enable leaves a signer attached                           | Compensating removal plus visible recoverable state.                                              |
| Partial revoke leaves durable authority active                    | Idempotent server-first denial, checked responses, signer removal, and retry UI.                  |
| A linked cross-app wallet from an unexpected provider is accepted | Filter/allowlist the approved Privy provider App ID.                                              |
| Arbitrary delegated execution expands blast radius                | Fixed contract targets, selector allowlists, typed inputs, value caps, and server reconstruction. |
| Cached quotes or indexes contradict the chain                     | Refresh before simulation/submission and treat onchain reads as authoritative.                    |
| Landing implies an undeployed protocol is live                    | Derive status from verified configuration and show a clear unavailable/not-deployed state.        |
| Statics and Eves show stale balances after an action              | Receipt-based invalidation/refetch and optional deep-link refresh hints.                          |
| Secrets enter the client bundle or repository                     | Environment schema, server-only modules, secret scans, and fail-closed builds.                    |

## Open decisions and external dependencies

These decisions do not block documenting or scaffolding the application, but they block later release gates:

- [ ] Confirm production domain and whether Statics and Eves will use sibling subdomains.
- [ ] Validate that the existing Eves Privy App ID, allowed origins, and production-domain settings support the planned Statics deployment.
- [ ] Create and review the Statics signer, authorization key, and policy definitions.
- [ ] Select the production database and hosting environment.
- [ ] Confirm the first supported network and public RPC strategy.
- [ ] Produce or select the verified Statics deployment manifest; none is currently recorded.
- [ ] Decide how the versioned Statics SDK and ABI artifacts enter this repository without production imports from `../statics`.
- [ ] Confirm which pegged profiles are part of the first Dollar release.
- [ ] Confirm whether autonomous Statics actions are a later product feature; they are out of scope for the initial one-click release.
- [ ] Confirm final Eves Market URL and desired handoff behavior.

## Progress log

Add dated entries with concrete evidence. Keep plans and completed work distinct.

| Date       | Area                    | Status                  | Evidence / note                                                                                                                             |
| ---------- | ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-22 | Landing prototype       | Superseded by migration | Legacy static sources were migrated into the Next.js route and component structure; approved assets were moved to `public/assets/`.         |
| 2026-07-22 | Phase 1 foundation      | Locally verified        | `npm run verify` passed lint, format, typecheck, 8 Vitest tests, production build, and 21 Playwright tests; `npm audit` found no issues.    |
| 2026-07-22 | Eves Privy/Wagmi review | Verified                | Current provider boundary and delegated/manual authorization paths reviewed; focused suite passed 36 tests and TypeScript typecheck passed. |
| 2026-07-22 | Statics DApp plan       | Documented              | This file created as the implementation and release tracker.                                                                                |

## Definition of done

The project is complete only when:

- The approved landing design is faithfully served from `/` without wallet runtime overhead.
- `/app` provides the agreed Statics Dollar and protocol workflows against verified contracts.
- The user sees the same Privy-owned wallet and Statics Dollar balance in Statics and Eves.
- Statics and Eve delegated authorities remain independently scoped, audited, and revocable.
- External wallets retain normal confirmations.
- Every value-moving action has fresh previews, explicit bounds, simulation, idempotency where applicable, confirmed receipts, and understandable failure states.
- Local, live-network, and production evidence are recorded separately and accurately.
- No production claim, deployment status, or balance is fabricated or inferred from placeholders.
- Security review, production QA, monitoring, documentation, and emergency revocation procedures are complete.
