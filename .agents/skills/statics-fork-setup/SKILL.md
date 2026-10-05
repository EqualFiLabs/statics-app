---
name: statics-fork-setup
description: Set up or resume the Statics app's local mainnet fork with inherited Genesis, locally deployed Phase 1 and a backfilled indexer. Use for contributor development on Linux, macOS or WSL2.
---

# Statics fork setup

Find the existing Statics app and protocol checkouts from the user's paths or nearby repository directories. Read their applicable instructions and [the manual guide](../../../docs/local-fork-testing.md) from the app repository root (`docs/local-fork-testing.md`); the guide is the command/configuration reference.

Check Node/npm, Foundry's historical-state flags, Ponder dependencies and the guide's supported protocol revision. Inspect branch and dirty state. Never switch branches, synchronize SDKs, initialize submodules or overwrite local configuration automatically. Explain any prerequisite mismatch and provide the manual checkout commands from the guide.

Use shell configuration or ignored `.env.fork.local` for `STATICS_PROTOCOL_REPOSITORY`, private `ROBINHOOD_MAINNET`, and maintainer-provided public Privy identifiers. Never print credentials or copy another contributor's runtime directory. Use the host's instructed private RPC source if one is explicitly configured; do not require a machine-specific source file for contributors.

Run `npm run dev:fork -- --profile NAME` in the app root. Default `dev` uses RPC 8663, indexer 42070 and localhost 3000. For a new session, use explicit alternate ports if occupied; do not kill foreign services. Existing profiles retain their recorded pin and settings. Keep the launcher running until instructed to stop.

Report readiness only after the launcher catches up and announces ready. Check `fork:status`, then explain the local wallet RPC/chain 4663 and Privy-approved localhost origin. Rerunning startup resumes/reuses the same profile. An uncertain deployment must retain its artifacts for diagnosis; never repeat it or create a replacement NFT automatically.

Hand off `verify:fork` for read-only state/browser verification. Funding, time advancement and lifecycle transactions belong to the testing skill and the user's requested testing scope. `fork:stop` saves and stops only the owned profile; leave unrelated running sessions intact.
