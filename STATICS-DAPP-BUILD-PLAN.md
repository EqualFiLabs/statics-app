# Statics Site and DApp Build Plan

- Last updated: 2026-07-24
- Status: Connected local runtime and signed-out reads verified; interactive wallet workflows remain unproven
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

For a browser-facing DApp workflow, `[x]` requires the configured application to render
authoritative local onchain state and complete the workflow through the actual Privy or external
wallet UI. Component mocks, transaction-builder tests, and direct Viem/Anvil scripts are supporting
evidence only; they can never close a browser-facing item by themselves.

Correction (2026-07-24): browser-facing protocol items were previously marked `[x]` from source,
mock, and headless Anvil evidence even though the configured wallet application had never rendered
or exercised them. Those completion claims were invalid and have been returned to `[~]`. The
underlying evidence remains recorded below, explicitly limited to what it proves.

## Product outcome

Build one Statics web product with two deliberately separated runtime surfaces:

- `/` is the public landing page. It preserves the current visual design, copy, Statics branding, and Robin Hood artwork. It does not load wallet SDKs.
- `/app` is the authenticated Statics DApp. It has its own login session and normal wallet flow. Using the same Privy App ID and user credential as Eves Market reuses the same embedded EVM wallet without sharing a browser session or delegated authority.

The first useful release is Dollar-first: a user signs in, sees the same wallet used by Eves Market, obtains or redeems Statics Dollar through a clear reviewed action, and then sees that same onchain Statics Dollar balance in Eves Market. Later releases add the broader basket, PositionNFT, lending, rewards, and canonical-liquidity surfaces already exposed by the Statics protocol.

## Current state

- The approved landing page is served at `/` by Next.js 16 and React 19, with its copy, responsive visual system, Statics branding, and Robin Hood hero preserved.
- `/app` always renders its complete route-specific interface. Runtime values come from the
  configured local Anvil deployment when available; missing wallet, deployment, loading, and RPC
  states render `--` without removing the screen, and dependent actions stay disabled.
  `npm run dev:preview` forces this unavailable-value presentation for visual regression work.
  `npm run dev:connected` imports only Eves Market's public Privy identifiers, deploys the current
  protocol to persistent Anvil, verifies runtime code hashes, and serves authoritative local data.
- The connected signed-out application has rendered every current route, opened the real Privy
  login modal, and read the two seeded baskets from the verified local deployment. No authenticated
  Privy identity, embedded wallet, external wallet, or browser-signed protocol transaction has been
  exercised yet.
- Final brand assets live in `public/assets/`; `mockup.png` remains the design reference.
- Vitest component/foundation tests and Playwright desktop, tablet, and mobile checks cover the landing, DApp shell, accessibility, route behavior, security headers, and visual snapshots.
- There is no delegated authority, API layer, database, or public Statics deployment configuration. Local development can generate code-hash-bound Anvil configuration from the protocol deployment script.
- The live protocol source is maintained separately in `../statics`.
- The protocol repository records no public Statics deployment. The DApp must not show a production address, live TVL, or “deployed” status until a verified deployment manifest exists.
- The canonical SDK is vendored from protocol commit `df56e5c5166c8aab155e516ced1053340993eb87` with SHA-256 provenance for every copied artifact.
- Eves Market already treats Statics Dollar as its default collateral/trading asset and contains a working Privy/Wagmi and delegated-signing reference implementation.

## Architecture decisions

| Area                  | Decision                                                                                                    | Reason                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Application framework | Use Next.js with TypeScript                                                                                 | Keeps the landing and DApp in one application while preserving room for later server routes if the protocol needs them. |
| Product boundary      | Keep Statics as a separate deployable application                                                           | Statics and Eves have distinct product UX, releases, server authority, and failure domains.                             |
| Landing and DApp      | Keep both in this Next.js application                                                                       | The landing can remain static while `/app` owns wallet and onchain runtime concerns.                                    |
| Wallet identity       | Reuse the same Privy App ID and user-owned embedded EVM wallet as Eves Market                               | The same Privy account should resolve to one address and one onchain balance across both products.                      |
| Session experience    | Keep Statics and Eves sign-ins independent                                                                  | A user may use either product without being a user of the other; no cross-domain SSO or cookie sharing is needed.       |
| Origin protection     | Do not configure Privy origin protection for the current local phase                                        | Origin policy is intentionally deferred and is not a prerequisite for local authentication review.                      |
| Provider order        | `QueryClientProvider -> PrivyProvider -> @privy-io/wagmi WagmiProvider -> Statics wallet bridge -> DApp UI` | The bridge consumes both Privy and Wagmi, and wallet-dependent children render only beneath the complete provider tree. |
| Landing runtime       | Do not initialize Privy/Wagmi on `/`                                                                        | Keeps the marketing page fast and prevents wallet-provider regressions from breaking the public site.                   |
| Signing model         | Use normal user-controlled Privy and external-wallet flows; do not install a Statics delegated signer       | The initial DApp does not need cross-app or autonomous authority.                                                       |
| External wallets      | Preserve ordinary wallet confirmation                                                                       | External-wallet users retain the confirmation and security model of their selected wallet.                              |
| Contract integration  | Use the unified `StaticsDiamond` for ordinary user actions and canonical protocol ABIs/SDK artifacts        | The protocol intentionally exposes a single normal integration address.                                                 |
| Transaction safety    | Typed actions only; exact approvals; fresh onchain previews; simulation; receipt verification               | The UI must never expose arbitrary calldata or an arbitrary transaction target.                                         |

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

Functional integration and visual approval are separate tracks. A checked browser workflow means
the configured DApp rendered authoritative state and completed the stated behavior through an
actual wallet; it does not mean the final visual design has been approved. Unavailable-value
states keep implemented screens visible for product review, but never count as functional
integration evidence.

| Route               | User outcome                                                                                                       | Initial release         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `/app`              | Portfolio overview, wallet, network, Statics Dollar balance, positions, pending rewards, and protocol status       | Yes                     |
| `/app/dollar`       | Deposit ETH/WETH, obtain Statics Dollar and Risk Shares, recombine to ETH/WETH, and use configured pegged profiles | Yes                     |
| `/app/activity`     | Pending, confirmed, failed, and replaced Statics actions with explorer links                                       | Yes                     |
| `/app/settings`     | Wallet information, embedded-wallet export guidance, and Statics-only logout                                       | Yes                     |
| `/app/baskets`      | Discover and inspect permissionless baskets and their lifecycle/risk metadata                                      | Next release            |
| `/app/baskets/[id]` | Quote, mint, redeem, and inspect constituent requirements and fees                                                 | Next release            |
| `/app/create`       | Create a permissionless basket with validated configuration and creation fee                                       | Later release           |
| `/app/positions`    | Inspect and manage PositionNFT legs, staking, basket collateral, Dollar legs, and transfer consequences            | Planned broader release |
| `/app/loans`        | Quote, borrow, repay, extend, and inspect recovery state per independent loan tranche                              | Planned broader release |
| `/app/rewards`      | Global staking, activation/cooldown, multi-asset pending rewards, and claims                                       | Planned broader release |
| `/app/liquidity`    | Canonical pool state, user v4 positions, staking, activation, claims, and exits                                    | Advanced release        |
| `/app/protocol`     | Read-only health, custody, lifecycle, timelock, and deployed-address information                                   | Yes, read-only          |

## User-facing protocol requirements

### Statics Dollar release

- [~] Display active wallet and network with no stale-address fallback; source and mock coverage exist, but no configured browser wallet has rendered them (`providers/wallet-context.tsx`, `components/app-shell/AppShell.tsx`).
- [~] Display authoritative Statics Dollar, WETH/ETH, and active-series Risk Share balances through the connected browser application (`components/dollar/DollarPage.tsx`).
- [~] Read profile configuration, debt ceilings, health state, exit availability, pause mask, oracle price, and current previews through the connected browser application.
- [~] Support typed ETH and WETH deposits through the verified local gateway and actual browser wallet.
- [~] Support ordinary recombination to WETH or ETH through the actual browser wallet.
- [-] Support EIP-2612 permit recombination; deferred until after ordinary local flows.
- [-] Support configured pegged-profile mint and redemption; outside the first local WETH profile scope.
- [~] Keep Risk Share ERC-1155 operator approval separate, explain its all-series scope, and expose revocation through the connected browser application.
- [~] Refresh authoritative previews before simulation and refresh balances after browser-wallet receipts.
- [~] Apply the tested operation-specific profile, series, oracle, health, debt, pause, balance, quote, and exit eligibility rules in the connected browser application (`lib/dollar/action-state.ts`).
- [~] Preserve prior previews during refresh without allowing stale input or series data to submit through the connected browser application.
- [~] Distinguish simulation, signature, rejection, submission, replacement, confirmation, reversion, and local failure using actual browser-wallet activity.

### Basket release

- [~] Discover baskets from indexed creation events and reconcile them with current onchain state in the connected browser application.
- [~] Show authoritative one-to-sixteen constituent data, bundle amounts, lifecycle, fee tiers, LTV, loan duration, and token-risk warnings.
- [~] Quote mint/redeem immediately before browser-wallet submission.
- [~] Present constituent approvals sequentially and use exact/bounded amounts through the actual wallet.
- [~] Apply receiver-side minimum outputs and caller-selected slippage limits through the actual wallet.
- [~] Verify the connected browser presentation does not imply that holding BasketTokens earns basket-specific fees.

### Positions, lending, and rewards release

- [~] Create and inspect wallet-owned PositionNFTs from event discovery reconciled against current ownership in the connected browser application (`components/positions`, `lib/positions/positions.ts`).
- [~] Verify the connected browser explanation that transferring a PositionNFT transfers every attached protocol leg and obligation.
- [~] Support global staking, authoritative cooldown state, per-position reward opt-in/out, and pending multi-asset reward reads through the actual wallet.
- [~] Support selected multi-asset reward claims with fresh minimums, receipt checks, balance reconciliation, and closure after obligations clear through the actual wallet.
- [~] Support basket collateral deposits, direct mint-to-collateral, withdrawals, and redemptions with exact approvals and fresh bounds through the actual wallet.
- [~] Show authoritative loans as independent tranches with principal vectors, maturity, and recovery time in the connected browser application.
- [~] Support borrow, repay, extend, and permissionless recovery using fresh authoritative state and quotes through the actual wallet.
- [~] Block position closure while any leg remains live and allow closure only after current browser state reports zero active legs.

### Canonical liquidity release

- [~] Show authoritative zero native v4 LP fee separately from bilateral Statics hook fees in the connected browser application.
- [~] Show authoritative pool lifecycle, warm-up, observation state, manager sync, fee allocation, pending POL, and locked POL.
- [~] Support user-owned PositionManager NFT creation and discovery through the actual wallet.
- [~] Support staking, next-block activation, increase, claim, and immediate unstake for qualifying full-range LP NFTs through the actual wallet.
- [~] Support the advanced atomic collateral-funded borrow-to-liquidity path with one reviewed pool input per basket constituent through the actual wallet.
- [~] Verify the connected browser clearly distinguishes hook-owned permanent liquidity from user-owned LP NFTs.

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
- [x] Reuse the approved public Privy App ID through a strict local importer; the connected browser
      opened the actual Privy modal (`scripts/lib/local-privy.mjs`, `scripts/import-local-privy.mjs`,
      `test/e2e/connected-local.spec.ts`).
- [~] Validate deterministic embedded-first account selection and embedded/external wallet detection through configured Privy and external browser wallets; source and mock coverage exist.
- [~] Exercise normal sign-in, external connection, embedded-wallet creation/reuse, Statics-only logout, chain switching, and wallet export guidance through the configured browser application; source and mock coverage exist.
- [!] Prove that the same Privy identity resolves to the same EVM address in Statics and Eves;
  requires interactive authentication in both applications.

Gate: provider-order regressions pass; missing configuration fails closed outside development; embedded and external wallet journeys pass interactively. No contract or value-moving proof is claimed by this phase.

### Statics Actions delegation

[-] Removed from the current product plan. Statics uses normal user-controlled wallet signing and does not reuse or create delegated Eves capabilities.

### Statics Dollar DApp

- [~] Render the Dollar dashboard from authoritative protocol reads in the connected browser application; source, mock, and headless protocol evidence exist.
- [~] Exercise ETH/WETH deposit and ordinary ETH/WETH recombination with normal browser-wallet confirmation; source and headless protocol evidence exist.
- [~] Exercise exact ERC-20 approval sequencing, explicit ERC-1155 operator approval/revocation, and receipt-confirmed browser activity; source and headless protocol evidence exist.
- [~] Validate the optional Eves Market handoff in the connected application; its unconfigured disabled presentation exists.

Gate: every value-moving flow passes on a local fork/rehearsal using real contracts and real approvals; unit mocks alone do not satisfy this gate.

Headless protocol evidence (2026-07-22): `npm run test:integration:local` generated an ephemeral
Anvil identity, deployed the full stack through `DeployStaticsDollar.runLocal`, and confirmed two
real protocol lifecycles using a direct Viem wallet. The test deposited ETH, verified Dollar and
Risk minting, approved exact Dollar plus the Risk gateway operator, and recombined to ETH. It then
wrapped fixture ETH, approved exact WETH, deposited WETH, recombined to WETH, and asserted the final
Dollar, Risk, and WETH balances. It did not render or exercise the DApp through Privy or an external
browser wallet and therefore does not close the browser-facing items above.

The final site gate passed lint, formatting, TypeScript, 31 Vitest tests, the Next.js production build, and 24 Playwright checks across desktop, tablet, and mobile. The canonical protocol SDK separately passed 24 tests and its TypeScript build before commit `be81deec2424dd6ad18ab9cbd192632ed39c4921`.

### Wallet and Dollar release rehearsal

- [x] Implement and unit-test the deterministic operation-specific eligibility and one-next-action state model.
- [x] Implement and unit-test recombination result decoding and unavailable or zero-output rejection.
- [x] Implement and unit-test current/previous preview identity and stale-submission blocking.
- [x] Implement and unit-test the activity state model, replacement metadata, and verified-chain-only explorer-link rules.
- [x] Document a credential-safe embedded and external wallet rehearsal (`WALLET-DOLLAR-REHEARSAL.md`).
- [!] Prove the same Privy identity resolves to the exact same embedded address in Statics and Eves;
  requires interactive authentication in both applications.
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

- [~] Basket discovery, details, mint, and redemption; source and headless protocol evidence exist, but the connected browser workflow is unverified.
- [~] PositionNFT, basket collateral, and global staking; source and headless protocol evidence exist, but the connected browser workflow is unverified.
- [~] Loan quote, borrow, repay, extend, maturity, and recovery displays; source and headless protocol evidence exist, but the connected browser workflow is unverified.
- [~] Multi-asset reward claims; source and headless protocol evidence exist, but the connected browser workflow is unverified.
- [~] Permissionless basket creation; source and headless protocol evidence exist, but the connected browser workflow is unverified.
- [~] Canonical v4 liquidity and user LP NFT management; source and headless protocol evidence exist, but the connected browser workflow is unverified.

Gate: each lifecycle has focused unit coverage, at least one real local protocol integration flow,
and a configured browser-wallet flow against a persistent verified local deployment. Current
onchain state remains authoritative over cached/indexed data. Headless integration alone cannot
close this gate.

Headless basket protocol evidence (2026-07-23): canonical SDK commit
`643c979d3aa64a177b123becb91cf92df762929e` added authoritative basket reads, events, token
metadata, and basket errors; its 25 tests and TypeScript build passed. The vendored artifact records
that clean protocol commit plus source and generated-artifact checksums. The focused Foundry basket
lifecycle suite passed 17 tests. `npm run test:integration:local` deployed the unified stack to
ephemeral Anvil, recorded its deployment event range, created the exact-fee local Dollar-backed
fixture, discovered its indexed creation event, funded the wallet through the real Dollar ETH
deposit flow, established a bounded constituent approval, minted and redeemed BasketTokens with
fresh caller/receiver bounds, and verified receipts, supply, vault backing, and wallet balances.
This is headless protocol proof only; no Privy or external browser wallet rendered or exercised
the workflow, and no public-network or production transaction was performed.

Headless position and rewards protocol evidence (2026-07-23): canonical SDK commit
`f82f3a7e4ba4c9bfbf749c3208f68bb18fd4afa1` added PositionNFT ownership/state, basket
collateral, global staking, reward selection, pending-reward, event, and error interfaces; its 26
tests and TypeScript build passed. The vendored artifact records that clean protocol commit plus
source and generated-artifact checksums. `npm run test:integration:local` deployed the current
unified stack to ephemeral Anvil and confirmed PositionNFT creation and ownership, exact
BasketToken approval, next-block collateral withdrawal, bounded direct mint-to-collateral and
redemption, empty-position closure, exact WETH staking approval, atomic create-and-stake, selected
Dollar reward accrual, opt-out preservation with no future accrual, opt-in cooldown restart, full
unstake, selection clearing, and close blocking while earned rewards remain pending. Reward claims
were not invoked. `npm run verify` passed lint, formatting, TypeScript, 73 Vitest tests, the Next.js
production build, and 30 Playwright checks across desktop, tablet, and mobile. This is headless
protocol proof only; no Privy or external browser wallet rendered or exercised the workflow, and no
public-network or production transaction was performed.

Connected local runtime evidence (2026-07-24): `npm run dev:connected` imported only the shared
public Privy App ID, generated an ephemeral local operator, deployed protocol commit
`df56e5c5166c8aab155e516ced1053340993eb87` to persistent Anvil chain `31337`, verified every
configured runtime code hash, and seeded Dollar- and WETH-backed baskets. `npm run
verify:connected:local` passed three Playwright checks: every current DApp route rendered with the
real runtime and no sample markers or browser errors, `/` remained outside wallet runtime, the
signed-out basket catalog read both seeded baskets and exposed permissionless creation, and the
actual Privy login modal opened. The ignored evidence record explicitly marks Privy identity and
external-wallet lifecycle proof `not-executed`.

The typed local controls can fund one exact wallet, advance bounded time, generate selected
PositionNFT rewards, generate canonical LP fees for a staked LP NFT, and move an existing loan into
its recoverable time window; they accept no arbitrary target or calldata. The current `npm run
test:integration:local` also passed Dollar, basket creation, collateral, lending, multi-asset
rewards, canonical LP NFT, LP claim, and borrow-to-liquidity lifecycles. That integration remains
direct-Viem headless evidence. No Privy-authenticated address, embedded or external browser wallet,
browser-signed value-moving lifecycle, public-network action, or production deployment is claimed.

Headless loan protocol evidence (2026-07-23): canonical SDK commit
`8bf30cd3bdd8d32f1b5e4cc6ae4e3d3c0269b18f` added authoritative loan reads, lifecycle
events, lending errors, and recovery timing; its 27 tests and TypeScript build passed. The vendored
artifact records that clean protocol commit plus source and generated-artifact checksums. The
unexercised `/app/loans` source path is designed to reconcile originated and closed loan events against current
PositionNFT ownership, rebuilds fresh quotes before simulation, sequences one exact token approval
at a time, preserves confirmed receipts whose resulting state still needs refresh verification, and
keeps the approved development preview when local deployment configuration is absent.
`npm run test:integration:local` deployed the current unified stack to ephemeral Anvil and confirmed
borrow principal delivery and collateral locking, exact-fee extension with unchanged principals,
exact-principal repayment and collateral unlock, and recovery by a second account strictly after
the grace period with surplus reclassification, collateral removal, loan deletion, and no caller
token reward. This is headless protocol proof only; no Privy or external browser wallet rendered or
exercised the workflow, and no public-network or production transaction was performed.
`npm run verify` passed lint, formatting, TypeScript, 109 Vitest tests, the production build, and 39
Playwright checks across desktop, tablet, and mobile.

Remaining headless protocol-flow evidence (2026-07-23): canonical SDK commit
`df56e5c5166c8aab155e516ced1053340993eb87` adds the verified local Uniswap v4 deployment
foundation, code-hashed PoolManager, PositionManager, Permit2, and StateView bindings, and the
typed interfaces used by the final DApp flows. The vendored artifact records that clean protocol
commit plus source and generated-artifact checksums. `npm run test:integration:local` deploys the
current unified stack to ephemeral Anvil and confirms permissionless basket creation with the exact
current fee; selected multi-asset reward claims with simulation, events, cleared pending state, and
wallet balance reconciliation; canonical pool warm-up and activation; bounded ERC-20 and Permit2
allowances; wallet LP NFT creation, staking, next-block activation, increase, real-swap fee accrual,
claim, and unstake; and atomic collateral-funded borrow-to-liquidity followed by repayment.
`npm run verify` covers source, mock, unavailable-state, and build checks. This is headless protocol
proof only; no Privy or external browser wallet rendered or exercised these workflows, and no
public-network or production transaction was performed.

### DApp visual design and product review

- [x] Keep every existing `/app` route fully rendered when wallet, deployment, or RPC data is absent.
- [x] Render unavailable onchain and wallet values as `--` without fabricating balances, addresses, positions, or status.
- [x] Keep every unavailable-state transaction, copy, explorer, and export control disabled.
- [x] Desktop, tablet, and mobile implementation plus snapshot coverage is locally verified and product-approved for the overview, Dollar, basket catalog/detail, PositionNFT catalog/detail, rewards, activity, and settings.
- [~] Loan, multi-asset reward-claim, permissionless basket-creation, and canonical-liquidity
  screens retain disabled unavailable-value states and responsive snapshot coverage; explicit
  product approval remains pending before functional implementation is treated as product-complete.
- [~] Populate the persistent screens with verified local onchain states during integration review
  without changing their information hierarchy. Every route now survives an unavailable Anvil RPC
  without collapsing; authenticated state and value-moving browser workflows remain open.

Gate: reviewed screenshots cover every current DApp surface at desktop, tablet, and mobile sizes.
Production actions still fail closed without verified wallet, network, and deployment
configuration, while the non-value-moving screen layout remains visible.

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
- [-] Privy origin protection is intentionally deferred for the current phase; it is not a local
  sign-in prerequisite.
- [x] Select Robinhood Chain Testnet (chain ID 46630) as the wallet foundation target; select a dedicated staging/production RPC before deployment.
- [ ] Produce or select the verified Statics deployment manifest; none is currently recorded.
- [x] Vendor the versioned canonical Statics SDK with protocol commit and SHA-256 provenance; production imports remain independent from `../statics`.
- [ ] Confirm which pegged profiles are part of the first Dollar release.
- [ ] Confirm final Eves Market URL and desired handoff behavior.

## Progress log

Add dated entries with concrete evidence. Keep plans and completed work distinct.

| Date       | Area                        | Status                      | Evidence / note                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | --------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-22 | Landing prototype           | Superseded by migration     | Legacy static sources were migrated into the Next.js route and component structure; approved assets were moved to `public/assets/`.                                                                                                                                                                                                                                                                                                                       |
| 2026-07-22 | Foundation implementation   | Locally verified            | `npm run verify` passed lint, format, typecheck, 8 Vitest tests, production build, and 21 Playwright tests; `npm audit` found no issues.                                                                                                                                                                                                                                                                                                                  |
| 2026-07-22 | Eves Privy/Wagmi review     | Verified                    | Current provider boundary and delegated/manual authorization paths reviewed; focused suite passed 36 tests and TypeScript typecheck passed.                                                                                                                                                                                                                                                                                                               |
| 2026-07-22 | Statics DApp plan           | Documented                  | This file created as the implementation and release tracker.                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-07-22 | Wallet foundation           | Interactive proof blocked   | Provider source and mock regressions passed, but no configured Privy or external browser wallet was exercised. The earlier `Locally verified` status was invalid.                                                                                                                                                                                                                                                                                         |
| 2026-07-22 | Dollar safety rehearsal     | Source/headless proof only  | Deterministic guards and direct-Viem Anvil ETH/WETH lifecycles passed. No connected browser-wallet Dollar lifecycle ran, so this is not DApp workflow verification.                                                                                                                                                                                                                                                                                       |
| 2026-07-23 | Basket use flows            | Source/headless proof only  | Event reconciliation, transaction construction, mock UI behavior, and direct-Viem Anvil basket mint/redemption passed. No connected browser-wallet basket workflow ran.                                                                                                                                                                                                                                                                                   |
| 2026-07-23 | Position and rewards flows  | Source/headless proof only  | Position, collateral, staking, reward-selection, and closure source paths plus direct-Viem Anvil lifecycles passed. No connected browser-wallet workflow ran.                                                                                                                                                                                                                                                                                             |
| 2026-07-23 | DApp sample design preview  | Locally verified            | Unconfigured development now renders labelled deterministic sample states across every current DApp route with value-moving controls disabled. `npm run verify` passed lint, formatting, TypeScript, 78 Vitest tests, production build, and 33 Playwright checks; desktop and mobile detailed previews were inspected before snapshot acceptance.                                                                                                         |
| 2026-07-23 | DApp visual review support  | Awaiting product review     | Route-specific presentation, accessible responsive navigation, compact mobile hierarchy, alternate sample states, and a complete nine-surface snapshot matrix are implemented. All desktop, tablet, and mobile surfaces plus both responsive drawers were inspected. `npm run verify` passed lint, formatting, TypeScript, 89 Vitest tests, production build, and 36 Playwright checks.                                                                   |
| 2026-07-23 | Remaining DApp previews     | Awaiting product review     | Loans, multi-asset reward claims, three-step permissionless basket creation, and canonical-liquidity/user LP NFT management are implemented as deterministic development previews with all wallet and value-moving controls disabled. Desktop, tablet, and mobile surfaces plus the basket economics/review states were inspected. `npm run verify` passed lint, formatting, TypeScript, 98 Vitest tests, the production build, and 39 Playwright checks. |
| 2026-07-23 | Loan lifecycle              | Source/headless proof only  | Loan source paths, focused tests, and direct-Viem Anvil borrow/extend/repay/recovery passed. No connected browser-wallet loan workflow ran; the earlier `Locally verified` status was invalid.                                                                                                                                                                                                                                                            |
| 2026-07-23 | Remaining protocol flows    | Source/headless proof only  | Direct-Viem Anvil exercised basket creation, multi-asset claims, canonical liquidity, LP NFTs, and borrow-to-liquidity. No connected Privy or external-wallet browser workflow ran; the earlier `Locally verified` status was invalid.                                                                                                                                                                                                                    |
| 2026-07-24 | Completion-claim correction | Corrected                   | Browser-facing `[x]` marks and progress statuses unsupported by configured browser-wallet evidence were removed. Sample previews, mocks, and direct-Viem Anvil runs remain recorded only at their actual evidence level.                                                                                                                                                                                                                                  |
| 2026-07-24 | Connected local runtime     | Signed-out runtime verified | Persistent Anvil deployment and code hashes were verified; all current routes rendered without sample fallback or browser errors; the real Privy modal opened; and authoritative basket discovery found both fixtures. Interactive identity, embedded/external wallet, and browser-signed value workflows remain open.                                                                                                                                    |
| 2026-07-24 | Persistent unavailable UI   | Locally browser verified    | With the app configured for Anvil and `127.0.0.1:8545` unavailable, all twelve DApp routes retained their complete screen layouts, rendered unavailable values as `--`, kept dependent actions disabled, and exposed no raw Viem transport error.                                                                                                                                                                                                         |

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
