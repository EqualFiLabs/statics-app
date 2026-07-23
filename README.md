# Statics Site

The Statics marketing site and DApp foundation are built with Next.js 16 and React 19.

## Routes

- `/` — static marketing landing page with no wallet runtime.
- `/app` — route-scoped Privy/Wagmi wallet foundation targeting Robinhood Chain Testnet.

Statics and Eves Market intentionally keep separate login sessions. Configure Statics with the
same public Privy App ID and use the same user credential to resolve the same embedded EVM wallet;
no Eves delegation or server signer is reused.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` only when environment overrides are needed. Do not commit environment files or credentials.

## Verification

```bash
npm run verify
```

The verification gate runs linting, formatting checks, TypeScript, unit/component tests, the production build, and Playwright across desktop, tablet, and mobile viewports.

See `STATICS-DAPP-BUILD-PLAN.md` for the product roadmap, security boundaries, phase gates, and progress record.
