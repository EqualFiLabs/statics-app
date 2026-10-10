---
name: statics-fork-testing
description: Verify or test an existing Statics contributor fork, including read-only state/browser acceptance, explicit wallet funding and time changes, or isolated lifecycle transactions.
---

# Statics fork testing

Locate the app checkout and chosen profile. Read [docs/local-fork-testing.md](../../../docs/local-fork-testing.md) and applicable repository instructions. If the fork is absent, follow the guide's setup/resume commands; do not clone another runtime directory.

Start with `npm run fork:status -- --profile NAME`. Default verification is `npm run verify:fork -- --profile NAME`: full Operator/credit/indexer comparisons plus three browser checks. It submits no transactions or clock changes. Report its results separately from wallet authentication and signing, which require manual Privy sign-in on an approved localhost origin.

Verification also checks the Phase 1 fixture's recorded price against Doppler at the pinned snapshot and its confirmed initialization event. Later local trading can move either pool independently. For unrealistic liquidity amounts, inspect `marketFixture` provenance and the selected pool's current price before changing app amount math. A missing legacy price record is a verification failure, not permission to reset or reseed an interactive profile. Preserve it and arrange a reviewed fixture migration or separately named fresh profile.

When the user's testing request includes funding, use `fork:fund-wallet -- ADDRESS --eth AMOUNT --weth AMOUNT --statics AMOUNT --profile NAME`. Amounts are exact additions/transfers from local fixtures; insufficient funds fail. After an interrupted request inspect receipt records before retrying. Never use balance replacement, arbitrary RPC, upstream submission or a mainnet wallet endpoint.

Use `fork:advance-time -- SECONDS --profile NAME` only when the requested scenario needs an explicit clock change. Explain the impact on rewards and credit maturity before executing an already-authorized test. Do not warp an interactive session merely to make read-only verification pass.

For transaction acceptance run `npm run test:fork -- --profile NAME`. It creates and stops its own disposable test profile on separate ports. Inspect `lifecycle-results.json` for all seven groups and any missing-snapshot skips; skipped prerequisites are not passes. Retain failure artifacts. Use existing fixtures for Uniswap execution, never a fork-to-mainnet API chain mapping.

Record the snapshot block/hash, compatibility revisions, executed checks, skips and manual checks. Stop only sessions this work created or the user explicitly asked to stop. Do not remove recoverable profile data, alter production contracts or merge PRs.

Checkpoints save current state only; never request a full historical-state dump to back up an interactive fork. Preserve the indexer database and RPC cache. Successful block-pinned local reads are cached per profile for restart; uncached older reads fail without substituting latest state. Recent live history is bounded to 1,024 states, and older uncached local reads may require a separate fresh profile after restart. Oversized saved profiles must retain their original files for reviewed compact migration.

For local UI checks, use the built preview and rebuild after app changes. Do not start another development compiler alongside it.
