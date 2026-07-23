# Statics Site

The Statics marketing site and DApp foundation are built with Next.js 16 and React 19.

## Routes

- `/` — static marketing landing page with no wallet runtime.
- `/app` — Dollar overview and route-scoped Privy/Wagmi wallet runtime.
- `/app/dollar` — verified local ETH/WETH deposits and ordinary recombination.
- `/app/activity` — browser-local receipt activity scoped by wallet and chain.

Statics and Eves Market intentionally keep separate login sessions. Configure Statics with the
same public Privy App ID and use the same user credential to resolve the same embedded EVM wallet;
no Eves delegation or server signer is reused.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` only when environment overrides are needed. Do not commit environment files or credentials.

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
The local integration command separately deploys real contracts to ephemeral Anvil and proves ETH
and WETH Dollar lifecycles with real approvals and confirmed receipts.

See `STATICS-DAPP-BUILD-PLAN.md` for the product roadmap, security boundaries, phase gates, and progress record.
