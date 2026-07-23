# Statics Site and DApp Build Plan

- Last updated: 2026-07-22
- Status: Wallet and Dollar safety hardening locally verified; interactive Privy and public deployment proofs pending
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
- `/app` is the authenticated Statics DApp. It has its own login session and normal wallet flow. Using the same Privy App ID and user credential as Eves Market reuses the same embedded EVM wallet without sharing a browser session or delegated authority.

The first useful release is Dollar-first: a user signs in, sees the same wallet used by Eves Market, obtains or redeems Statics Dollar through a clear reviewed action, and then sees that same onchain Statics Dollar balance in Eves Market. Later releases add the broader basket, PositionNFT, lending, rewards, and canonical-liquidity surfaces already exposed by the Statics protocol.

## Current state

- The approved landing page is served at `/` by Next.js 16 and React 19, with its copy, responsive visual system, Statics branding, and Robin Hood hero preserved.
- A branded Dollar DApp is served at `/app`, with route-scoped Privy, Wagmi, Viem, and React Query providers; normal sign-in and connection controls; local Anvil switching; Dollar reads and actions; wallet-scoped activity; and wallet settings/export guidance.
- Final brand assets live in `public/assets/`; `mockup.png` remains the design reference.
- Vitest component/foundation tests and Playwright desktop, tablet, and mobile checks cover the landing, DApp shell, accessibility, route behavior, security headers, and visual snapshots.
- There is no delegated authority, API layer, database, or public Statics deployment configuration. Local development can generate code-hash-bound Anvil configuration from the protocol deployment script.
- The live protocol source is maintained separately in `../statics`.
- The protocol repository records no public Statics deployment. The DApp must not show a production address, live TVL, or “deployed” status until a verified deployment manifest exists.
- The canonical SDK is vendored from protocol commit `be81deec2424dd6ad18ab9cbd192632ed39c4921` with SHA-256 provenance for every copied artifact.
- Eves Market already treats Statics Dollar as its default collateral/trading asset and contains a working Privy/Wagmi and delegated-signing reference implementation.

## Architecture decisions

| Area                  | Decision                                                                                                              | Reason                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Application framework | Use Next.js with TypeScript                                                                                           | Keeps the landing and DApp in one application while preserving room for later server routes if the protocol needs them. |
| Product boundary      | Keep Statics as a separate deployable application                                                                     | Statics and Eves have distinct product UX, releases, server authority, and failure domains.                             |
| Landing and DApp      | Keep both in this Next.js application                                                                                 | The landing can remain static while `/app` owns wallet and onchain runtime concerns.                                    |
| Wallet identity       | Reuse the same Privy App ID and user-owned embedded EVM wallet as Eves Market, subject to dashboard origin validation | The same Privy account should resolve to one address and one onchain balance across both products.                      |
| Session experience    | Keep Statics and Eves sign-ins independent                                                                            | A user may use either product without being a user of the other; no cross-domain SSO or cookie sharing is needed.       |
| Provider order        | `QueryClientProvider -> PrivyProvider -> @privy-io/wagmi WagmiProvider -> Statics wallet bridge -> DApp UI`           | The bridge consumes both Privy and Wagmi, and wallet-dependent children render only beneath the complete provider tree. |
| Landing runtime       | Do not initialize Privy/Wagmi on `/`                                                                                  | Keeps the marketing page fast and prevents wallet-provider regressions from breaking the public site.                   |
| Signing model         | Use normal user-controlled Privy and external-wallet flows; do not install a Statics delegated signer                 | The initial DApp does not need cross-app or autonomous authority.                                                       |
| External wallets      | Preserve ordinary wallet confirmation                                                                                 | External-wallet users retain the confirmation and security model of their selected wallet.                              |
| Contract integration  | Use the unified `StaticsDiamond` for ordinary user actions and canonical protocol ABIs/SDK artifacts                  | The protocol intentionally exposes a single normal integration address.                                                 |
| Transaction safety    | Typed actions only; exact approvals; fresh onchain previews; simulation; receipt verification                         | The UI must never expose arbitrary calldata or an arbitrary transaction target.                                         |

## Wallet and identity model

### Shared identity inputs

- Privy App ID and the credential the user chooses to authenticate with.
- User-owned embedded EVM wallet and active wallet address.
- Supported-chain definitions where both products use the same network.
- Common account-selection rules so stale Wagmi connections cannot override the active Privy wallet.
- The resulting user-owned embedded wallet when the same Privy identity is used.

### Separate application state

- Statics and Eves authentication sessions, cookies, logout, and UI state.
- Active external-wallet selection in each application.
- Statics contract configuration, transaction state, and activity presentation.
- Any future server records required by Statics protocol workflows.

Eves signer IDs, authorization keys, policies, delegation records, or capability grants are never read, copied, or reused by Statics.

### Normal Statics wallet flow

1. The user signs into Statics with Privy or connects an external EVM wallet.
2. Email users reuse or create their Privy embedded EVM wallet; external-wallet users use the wallet they selected.
3. The DApp shows the exact active address, wallet type, and target network.
4. The user switches to Robinhood Chain Testnet when needed.
5. Future protocol actions present reviewed values and then use normal user-controlled wallet signing.
6. Logging out clears the Statics session only and does not claim to change the Eves session.

## DApp information architecture

Proposed routes may change during UX design, but the product capabilities should remain grouped as follows:

| Route               | User outcome                                                                                                       | Initial release  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `/app`              | Portfolio overview, wallet, network, Statics Dollar balance, positions, pending rewards, and protocol status       | Yes              |
| `/app/dollar`       | Deposit ETH/WETH, obtain Statics Dollar and Risk Shares, recombine to ETH/WETH, and use configured pegged profiles | Yes              |
| `/app/activity`     | Pending, confirmed, failed, and replaced Statics actions with explorer links                                       | Yes              |
| `/app/settings`     | Wallet information, embedded-wallet export guidance, and Statics-only logout                                       | Yes              |
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

- [x] Display active wallet and network with no stale-address fallback (`providers/wallet-context.tsx`, `components/app-shell/AppShell.tsx`).
- [x] Display Statics Dollar, WETH/ETH, and active-series Risk Share balances (`components/dollar/DollarPage.tsx`).
- [x] Read profile configuration, debt ceilings, health state, exit availability, pause mask, oracle price, and current previews.
- [x] Support typed ETH and WETH deposits through the verified local gateway.
- [x] Support ordinary recombination to WETH or ETH.
- [-] Support EIP-2612 permit recombination; deferred until after ordinary local flows.
- [-] Support configured pegged-profile mint and redemption; outside the first local WETH profile scope.
- [x] Keep Risk Share ERC-1155 operator approval separate, explain its all-series scope, and expose revocation.
- [x] Refresh authoritative previews before simulation and refresh balances after confirmed receipts.
- [x] Disable actions proactively from the operation-specific profile, series, oracle, health, debt, pause, balance, quote, and exit requirements (`lib/dollar/action-state.ts`).
- [x] Preserve prior previews during refresh without allowing stale input or series data to submit.
- [x] Distinguish simulation, signature, rejection, submission, replacement, confirmation, reversion, and local failure in browser-scoped activity.

### Basket release

- [x] Discover baskets from indexed creation events and reconcile them with current onchain state.
- [x] Show one-to-sixteen constituents, bundle amounts, lifecycle, fee tiers, LTV, loan duration, and token-risk warnings.
- [x] Quote mint/redeem immediately before submission.
- [x] Present constituent approvals sequentially and use exact/bounded amounts.
- [x] Apply receiver-side minimum outputs and caller-selected slippage limits.
- [x] Do not imply that holding BasketTokens earns basket-specific fees.

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
- Simulate immediately before requesting the user's wallet signature.
- Prevent duplicate submissions and track each wallet-submitted action through confirmation.
- Wait for a confirmed receipt and detect reverted or replaced transactions.
- Show plain-language errors without discarding the technical cause from logs.
- Never use an unlimited token approval by default.

## Client-first transaction design

The current scope has no delegated signer, transaction broadcaster, delegation database, or autonomous capability. Future protocol actions should be assembled from typed application inputs, simulated against fresh state, and submitted through the active user-controlled wallet. Activity may initially be derived from local pending state, receipts, and indexed onchain events. Add server persistence only when a concrete product requirement justifies it.

## Configuration and secret boundary

Public configuration may include:

- Privy App ID and client ID
- supported chain ID
- public RPC URL without embedded credentials
- verified contract addresses and deployment metadata

Server-only configuration includes:

- private RPC/API credentials
- database URL and credentials
- rate-limit and monitoring credentials

Required safeguards:

- [x] `.env*`, private keys, credentials, build output, and local databases are ignored (`.gitignore`).
- [x] Staging and production fail closed when the Privy App ID or Robinhood Testnet RPC is missing (`lib/wallet-config.ts`, wallet-config tests).
- [~] Contract addresses come from a code-hash-bound local deployment record; no checked-in public deployment manifest exists.
- [x] No server secret uses a `NEXT_PUBLIC_` prefix.
- [x] The local deploy helper requires a caller-supplied key, never writes it, and persists only public addresses, provenance, and runtime hashes.

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

### Independent wallet foundation

- [x] Add pinned Privy, Wagmi, Viem, and React Query versions (`package.json`, `package-lock.json`).
- [x] Implement the strict route-scoped provider hierarchy (`providers/DAppProviders.tsx`).
- [~] Reuse the approved Privy App ID; local configuration and Privy dashboard origin approval remain operator steps (`.env.example`).
- [x] Implement deterministic embedded-first account selection and embedded/external wallet detection.
- [x] Add normal sign-in, external connection, embedded-wallet creation/reuse, Statics-only logout, chain switching, and wallet export guidance.
- [!] Prove that the same Privy identity resolves to the same EVM address in Statics and Eves; requires interactive sign-in with the configured App ID and approved Statics origin.

Gate: provider-order regressions pass; missing configuration fails closed outside development; embedded and external wallet journeys pass interactively. No contract or value-moving proof is claimed by this phase.

### Statics Actions delegation

[-] Removed from the current product plan. Statics uses normal user-controlled wallet signing and does not reuse or create delegated Eves capabilities.

### Statics Dollar DApp

- [x] Implement the Dollar dashboard and authoritative protocol reads.
- [x] Implement ETH/WETH deposit and ordinary ETH/WETH recombination with normal wallet confirmation.
- [x] Add exact ERC-20 approval sequencing, explicit ERC-1155 operator approval/revocation, and receipt-confirmed local activity.
- [x] Add an optional validated Eves Market handoff that remains visibly disabled without configuration.

Gate: every value-moving flow passes on a local fork/rehearsal using real contracts and real approvals; unit mocks alone do not satisfy this gate.

Evidence (2026-07-22): `npm run test:integration:local` generated an ephemeral Anvil identity, deployed the full stack through `DeployStaticsDollar.runLocal`, and confirmed two real lifecycles. The test deposited ETH, verified Dollar and Risk minting, approved exact Dollar plus the Risk gateway operator, and recombined to ETH. It then wrapped fixture ETH, approved exact WETH, deposited WETH, recombined to WETH, and asserted the final Dollar, Risk, and WETH balances. This is local proof only and is not a Robinhood Testnet deployment or broadcast.

The final site gate passed lint, formatting, TypeScript, 31 Vitest tests, the Next.js production build, and 24 Playwright checks across desktop, tablet, and mobile. The canonical protocol SDK separately passed 24 tests and its TypeScript build before commit `be81deec2424dd6ad18ab9cbd192632ed39c4921`.

### Wallet and Dollar release rehearsal

- [x] Add deterministic operation-specific eligibility and one-next-action sequencing.
- [x] Decode recombination simulation results and refuse unavailable or zero-output exits before requesting a wallet signature.
- [x] Preserve current/previous preview identity and block submission while the current input refreshes.
- [x] Add accurate activity states, replacement metadata, and verified-chain-only explorer links.
- [x] Document a credential-safe embedded and external wallet rehearsal (`WALLET-DOLLAR-REHEARSAL.md`).
- [!] Prove the same Privy identity resolves to the exact same embedded address in Statics and Eves; requires dashboard origin approval and interactive authentication.
- [!] Complete the embedded-wallet UI Dollar lifecycle and external-wallet smoke test; requires interactive wallet access.

Gate: automated safety checks and the real local CLI lifecycle pass, then a human completes every
identity, embedded-wallet, and external-wallet outcome in the rehearsal checklist. Automated proof
does not close the interactive items.

Evidence (2026-07-22): `npm run verify` passed lint, formatting, TypeScript, 51 Vitest tests, the
Next.js production build, and 24 Playwright checks across desktop, tablet, and mobile.
`npm run test:integration:local` deployed current contracts to ephemeral Anvil and confirmed ETH and
WETH deposit/recombination lifecycles with available, nonzero decoded exit results. No Privy
identity, browser-wallet, public-network, or production proof is claimed.

### Broader protocol DApp

- [x] Basket discovery, details, mint, and redemption.
- [ ] PositionNFT, basket collateral, and global staking.
- [ ] Loan quote, borrow, repay, extend, maturity, and recovery displays.
- [ ] Multi-asset reward claims.
- [ ] Permissionless basket creation.
- [ ] Canonical v4 liquidity and user LP NFT management.

Gate: each lifecycle has focused unit coverage plus at least one real local integration flow. Current onchain state remains authoritative over cached/indexed data.

Basket evidence (2026-07-23): canonical SDK commit
`643c979d3aa64a177b123becb91cf92df762929e` added authoritative basket reads, events, token
metadata, and basket errors; its 25 tests and TypeScript build passed. The vendored artifact records
that clean protocol commit plus source and generated-artifact checksums. The focused Foundry basket
lifecycle suite passed 17 tests. `npm run test:integration:local` deployed the unified stack to
ephemeral Anvil, recorded its deployment event range, created the exact-fee local Dollar-backed
fixture, discovered its indexed creation event, funded the wallet through the real Dollar ETH
deposit flow, established a bounded constituent approval, minted and redeemed BasketTokens with
fresh caller/receiver bounds, and verified receipts, supply, vault backing, and wallet balances.
This is local proof only; no Privy, browser-wallet, public-network, or production transaction was
performed.

### Live-network readiness

- [ ] Record the authorized target network and verified deployment manifest.
- [ ] Validate every address, bytecode binding, chain ID, and supported action selector.
- [ ] Run full typecheck, lint, unit, component, integration, and production-build gates.
- [ ] Complete security review of authentication, wallet selection, transaction construction, and secret handling.
- [ ] Test the complete UI locally against the live network with read-only calls.
- [ ] Obtain explicit authorization before any public-testnet or value-moving live action.
- [ ] Execute small-value authorized smoke flows and preserve transaction evidence.

Gate: verified contracts, authorized receipts, no unresolved high-severity findings, no leaked secrets, and documented rollback/revocation procedures.

### Production release

- [ ] Configure verified production domains, allowed origins, cookie settings, RPCs, database, monitoring, and rate limits.
- [ ] Publish final title, description, favicon, OG image, documentation, terms, privacy, and security links.
- [ ] Verify mobile, keyboard, screen-reader, and reduced-motion behavior.
- [ ] Confirm no placeholder TVL, block height, deployment status, addresses, or unsupported actions remain.
- [ ] Confirm wallet sign-in, network switching, reads, manual actions, and Eves balance continuity.
- [ ] Document wallet and transaction incident response.

Gate: production QA checklist is signed off with URLs and evidence. A production bug returns to the previous validated phase; it is not patched around by weakening a security invariant.

## Verification matrix

| Layer                 | Required evidence                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Landing               | Visual screenshots, responsive checks, accessibility checks, production build                           |
| Provider boundary     | Source/behavior tests proving Wagmi remains under Privy and children never render during a provider gap |
| Identity              | Same Privy user and exact embedded address demonstrated in both products                                |
| Manual wallet actions | Simulation, wallet confirmation, receipt, balance refresh, and clear rejection handling                 |
| Protocol integration  | Focused contract/SDK tests plus local full-flow tests using real protocol deployments                   |
| Live network          | Explicit authorization, small-value receipts, verified addresses, and explorer evidence                 |
| Production            | Typecheck, tests, build, secret scan, monitoring, domain configuration, and end-to-end QA               |

## Known risks and mitigations

| Risk                                                      | Mitigation                                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Same wallet is mistaken for a shared session or authority | Explain separate sign-ins and never import Eves session, signer, policy, or delegation state. |
| Wallet children render before providers                   | Route-split runtime and regression tests for the strict provider tree.                        |
| An unexpected wallet becomes active                       | Use Privy-first deterministic selection and display the exact address and wallet type.        |
| Cached quotes or indexes contradict the chain             | Refresh before simulation/submission and treat onchain reads as authoritative.                |
| Landing implies an undeployed protocol is live            | Derive status from verified configuration and show a clear unavailable/not-deployed state.    |
| Statics and Eves show stale balances after an action      | Receipt-based invalidation/refetch and optional deep-link refresh hints.                      |
| Secrets enter the client bundle or repository             | Environment schema, server-only modules, secret scans, and fail-closed builds.                |

## Open decisions and external dependencies

These decisions do not block documenting or scaffolding the application, but they block later release gates:

- [ ] Confirm the production Statics domain; sibling-domain or SSO behavior is not required.
- [ ] Add the Statics origin to the existing Eves Privy App ID and validate normal independent sign-in.
- [x] Select Robinhood Chain Testnet (chain ID 46630) as the wallet foundation target; select a dedicated staging/production RPC before deployment.
- [ ] Produce or select the verified Statics deployment manifest; none is currently recorded.
- [x] Vendor the versioned canonical Statics SDK with protocol commit and SHA-256 provenance; production imports remain independent from `../statics`.
- [ ] Confirm which pegged profiles are part of the first Dollar release.
- [ ] Confirm final Eves Market URL and desired handoff behavior.

## Progress log

Add dated entries with concrete evidence. Keep plans and completed work distinct.

| Date       | Area                    | Status                  | Evidence / note                                                                                                                                                                                                                                                                                                       |
| ---------- | ----------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-22 | Landing prototype       | Superseded by migration | Legacy static sources were migrated into the Next.js route and component structure; approved assets were moved to `public/assets/`.                                                                                                                                                                                   |
| 2026-07-22 | Phase 1 foundation      | Locally verified        | `npm run verify` passed lint, format, typecheck, 8 Vitest tests, production build, and 21 Playwright tests; `npm audit` found no issues.                                                                                                                                                                              |
| 2026-07-22 | Eves Privy/Wagmi review | Verified                | Current provider boundary and delegated/manual authorization paths reviewed; focused suite passed 36 tests and TypeScript typecheck passed.                                                                                                                                                                           |
| 2026-07-22 | Statics DApp plan       | Documented              | This file created as the implementation and release tracker.                                                                                                                                                                                                                                                          |
| 2026-07-22 | Wallet foundation       | Locally verified        | `npm run verify` passed lint, format, typecheck, 18 Vitest tests, production build, and 24 Playwright tests. Reviewed three updated `/app` snapshots. Interactive Privy parity remains pending.                                                                                                                       |
| 2026-07-22 | Dollar safety rehearsal | Locally verified        | Operation-specific guards, stale-preview blocking, decoded recombination simulation, and accurate activity states passed focused and complete checks. Real Anvil ETH/WETH lifecycles passed; interactive Privy and external-wallet outcomes remain blocked.                                                           |
| 2026-07-23 | Basket use flows        | Locally verified        | Event-backed discovery, chain reconciliation, basket detail, sequential bounded approvals, mint/redeem quotes, protocol activity, and responsive route checks passed focused tests. Real ephemeral-Anvil Dollar funding, basket mint, and redemption passed; interactive wallet and public-network proof remain open. |

Dependency note (2026-07-22): safe `axios` and `ws` overrides remove the high-severity advisories inherited by the current Privy stack. `npm audit --omit=dev` still reports 10 moderate `uuid` advisories through Privy -> x402 -> Wagmi/MetaMask. npm offers only a forced downgrade of `@privy-io/react-auth`; that downgrade was not applied.

## Definition of done

The project is complete only when:

- The approved landing design is faithfully served from `/` without wallet runtime overhead.
- `/app` provides the agreed Statics Dollar and protocol workflows against verified contracts.
- The user sees the same Privy-owned wallet and Statics Dollar balance in Statics and Eves.
- Statics and Eves keep independent login sessions, and Statics never reuses Eves delegated authority.
- External wallets retain normal confirmations.
- Every value-moving action has fresh previews, explicit bounds, simulation, idempotency where applicable, confirmed receipts, and understandable failure states.
- Local, live-network, and production evidence are recorded separately and accurately.
- No production claim, deployment status, or balance is fabricated or inferred from placeholders.
- Security review, production QA, monitoring, documentation, and wallet incident procedures are complete.
