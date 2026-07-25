# Statics Site

The Statics marketing site and DApp foundation are built with Next.js 16 and React 19.

## Routes

- `/` — static marketing landing page with no wallet runtime.
- `/app` — Dollar overview and route-scoped Privy/Wagmi wallet runtime.
- `/app/wallet` — EVM and Solana assets, token management, sends, receives, and Portal access.
- `/app/portal` — Uniswap EVM swaps, Jupiter Solana swaps, Across funding, and Statics Dollar.
- `/app/dollar` — ETH/WETH deposits and recombination against verified deployments.
- `/app/activity` — wallet-scoped EVM, Solana, swap, bridge, and protocol activity.

Statics and Eves Market intentionally keep separate login sessions. Configure Statics with the
same public Privy App ID and use the same user credential to resolve the same embedded EVM wallet;
no Eves delegation or server signer is reused.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` only when environment overrides are needed. Do not commit
environment files or credentials. Normal development uses the configured runtime, including local
Anvil when selected. Every DApp route keeps its complete layout visible when wallet, deployment, or
RPC data is unavailable; affected values render as `--` and dependent actions remain disabled.
Use `npm run dev:preview` to render the labelled deterministic sample states used for visual
regression work.

The wallet imports the generated EVM token catalog and icons used by Eves Market, supports custom
ERC-20s, discovers SPL and Token-2022 balances, and uses Jupiter's token catalog for adding Solana
assets. Managed assets are shared with the Portal selectors.

The Portal implements the following reviewed transaction flows:

- Uniswap Trading API quotes, bounded approvals, wallet simulation, and receipt-confirmed EVM swaps.
- Jupiter Swap V2 order/sign/execute for Solana swaps.
- Across chain/token discovery, exact-input funding quotes, origin execution, and deposit-status
  recovery.
- Code-hash-bound USDG mint and redemption through the configured Statics Dollar gateway.

Uniswap, Jupiter, and Across credentials stay server-only. Across funding remains unavailable until
a checked-in verified Robinhood mainnet deployment manifest identifies the destination USDG and
gateway contracts. The current generated deployment profile is intentionally restricted to local
Anvil and cannot activate production bridging.

Primary integration references: [Uniswap Swapping API](https://developers.uniswap.org/docs/trading/swapping-api/integration-guide),
[Jupiter Swap V2 order and execute](https://developers.jup.ag/docs/swap/order-and-execute), and
[Across Swap API](https://docs.across.to/introduction/swap-api).

To reuse the same Privy app and embedded-wallet identity as the sibling Eves Market checkout,
import its browser-safe identifiers:

```bash
npm run config:privy:local
```

The importer reads `../market-ui/eves-market-ui/.env.local`, copies only
`NEXT_PUBLIC_PRIVY_APP_ID` and the optional `NEXT_PUBLIC_PRIVY_CLIENT_ID`, and never copies or
prints secrets, delegated signer settings, policies, or authorization material. Set
`EVES_MARKET_ENV_PATH` to an alternate file path when the sibling checkout is elsewhere. Statics
and Eves still have separate login sessions.

For a persistent connected DApp with a fresh verified protocol deployment, use:

```bash
npm run dev:connected
```

This starts loopback-only Anvil and Next.js processes, deploys the current sibling Statics
checkout, seeds two discoverable baskets, and keeps the randomly generated local operator key only
in the supervisor process. The public deployment addresses, protocol commit, and runtime code
hashes are written to ignored `.env.local`; the local control socket is mode `0600`.

In another terminal, inspect or prepare the exact browser wallet:

```bash
npm run local:status
npm run local:fund-wallet -- 0xYourWallet --eth 5 --weth 25
npm run local:advance -- 3600
npm run local:generate-rewards -- 1 --shares 0.1
npm run local:generate-lp-fees -- 1 1001 --amount 0.000001
npm run local:seed-recovery -- 1
```

These controls accept only chain `31337`, bounded typed inputs, and exact wallet addresses. They
cannot submit arbitrary targets or calldata. Reward and LP-fee generation require the referenced
PositionNFT and LP NFT to have been created, opted in, staked, and activated through the DApp.
Recovery seeding advances an existing loan beyond its grace period but leaves the permissionless
recovery action for the browser rehearsal.

With `dev:connected` still running, verify every route is using authoritative local runtime data
rather than unavailable-value fallbacks:

```bash
npm run verify:connected:local
```

This writes ignored local evidence for the route/runtime gate. It explicitly records Privy identity
and external-wallet lifecycle proof as not executed; complete those interactive checks with
`WALLET-DOLLAR-REHEARSAL.md`.

To deploy a fresh local Dollar stack, start Anvil and supply a funded development key without
placing it in a file:

```bash
PRIVATE_KEY=... npm run deploy:dollar:local
```

The helper accepts only chain `31337`, never writes the key, and updates ignored `.env.local` with
public addresses, the protocol commit, and runtime code hashes. There is no configured public
Statics deployment.

## Verification

```bash
npm run verify
npm run test:integration:local
```

The verification gate runs linting, formatting checks, TypeScript, unit/component tests, the production build, and Playwright across desktop, tablet, and mobile viewports.
The local integration command separately deploys real contracts to ephemeral Anvil and proves
ETH/WETH Dollar lifecycles, USDG-backed mint and redemption, basket creation, collateral, lending,
multi-asset rewards, canonical LP NFT management, LP claims, and borrow-to-liquidity with real
approvals and confirmed receipts.

See `STATICS-DAPP-BUILD-PLAN.md` for the product roadmap, security boundaries, phase gates, and progress record.
Use `WALLET-DOLLAR-REHEARSAL.md` for the local Privy identity, embedded-wallet Dollar, and
external-wallet acceptance checklist.
