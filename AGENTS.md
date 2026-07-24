# AGENTS.md

These instructions apply to the entire `statics-site` repository. They supplement any parent workspace instructions. If instructions conflict, follow the stricter safety, testing, and scope requirement.

## Repository priorities

1. Preserve correct value-moving behavior as the DApp is introduced.
2. Preserve the approved landing design and keep `/` independent from wallet runtime code.
3. Prefer deterministic execution and verified onchain or deployment data over inference.
4. Use the live checkout as the implementation source of truth. Treat planning documents as historical context unless current code and focused tests confirm them.
5. Keep changes narrow. Do not rewrite unrelated code or absorb unrelated dirty files.
6. Never imply that Statics is deployed, configured, audited, connected, or live without current verifiable evidence.

## Naming constraint

Do not use `Task`, `Task 1`, `Task 2`, or similar labels in filenames, function names, commit messages, or user-facing completion language.

Use descriptive names based on behavior or domain responsibility.

## Application boundaries

- `/` is the public marketing surface and must not initialize or import Privy, Wagmi, wallet bridges, delegated-signing code, or other DApp runtime dependencies.
- `/app` owns wallet and onchain runtime concerns as they are introduced.
- Keep Privy provider order and wallet context boundaries explicit and covered by regression tests.
- Share the user's approved Privy identity and embedded wallet with Eves Market, but never reuse Eve's delegated signer, policies, authorization key, delegation record, or capability grants.
- Keep manual one-click authority separate from autonomous capabilities.
- External wallets retain ordinary wallet confirmation unless the user explicitly authorizes a different reviewed flow.
- Contract addresses and live status must come from a verified deployment manifest, never placeholders, memory, or adjacent planning documents.

## Required verification

For every TypeScript or TSX change, run:

```bash
npm run typecheck
```

Run the narrowest meaningful Vitest files for changed behavior while developing:

```bash
npx vitest run path/to/relevant.test.ts
```

Every behavior change must include or update a regression test. Do not rely on compilation alone.

For layout, navigation, accessibility, responsive, or route-boundary changes, run the relevant Playwright checks. Update visual snapshots only after inspecting the rendered result and confirming that the change is intended.

Before handing off implementation changes, run the complete repository gate:

```bash
npm run verify
git diff --check
```

Expand verification in proportion to risk. Report exactly which checks ran and whether they passed. Never describe an unrun or skipped check as passing.

## Testing scope and resource discipline

- Tests exist to prove behavior, state transitions, safety boundaries, parsing, configuration, and transaction correctness. Do not use tests to duplicate or approve visual design.
- Do not assert placeholder text such as `--`, headings, labels, explanatory copy, sample values, exact card or row counts, CSS classes, spacing, or other presentational details unless that exact text or semantic attribute is itself a functional requirement.
- Do not add or replace tests one-for-one merely because visible copy or fixture values changed. Delete obsolete presentation assertions and retain only the smallest behavioral regression that protects the changed invariant.
- Do not create broad route matrices, screenshot suites, or per-surface component tests to prove that screens look populated. One focused behavioral test should cover shared fallback or availability logic.
- Playwright should test browser behavior such as navigation, keyboard interaction, accessibility semantics, route boundaries, and critical workflows. Do not treat screenshot comparison as evidence that a design is correct.
- Do not create or update visual snapshots unless the user explicitly requests automated visual regression coverage. Visual acceptance requires actual browser inspection and user judgment.
- Reuse existing coverage before adding new tests. Avoid custom verification scripts when an existing focused test can prove the same behavior.
- Keep the verification effort proportional to the implementation risk. A presentation-only change does not justify exhaustive application or protocol test expansion.

## Test fidelity

- Use unit tests for parsing, validation, configuration, error branches, and deterministic state transitions.
- Use component tests for user-visible state and interaction behavior.
- Use Playwright for route composition, keyboard behavior, accessibility, responsive behavior, security headers, and critical browser flows.
- Prefer real local contract flows over mocked orchestration for value-moving behavior.
- Require an integration or rehearsal flow for every value-moving lifecycle; unit mocks alone are not sufficient proof.
- A prepared or broadcast transaction is not sufficient proof. Verify the exact wallet, network, contract, action, bounded amount, receipt status, and resulting state.
- If a synthetic shortcut is necessary, document why in the test and keep it narrow.

## Live-value safety

Never broadcast a transaction, mint, deposit, approve, permit, redeem, withdraw, bridge, delegate authority, revoke authority, or perform another live value-moving action without explicit authorization for that action in the current conversation.

Before a live value-moving check, establish:

- the exact wallet or delegated account;
- the network and verified contract target;
- the exact action, asset, and maximum amount;
- the approval, signer, or policy changes involved;
- whether the run is expected to move real value.

Do not treat authorization from an earlier run as authorization for another run. Start with read-only discovery and simulation whenever possible. Never print private keys, API secrets, access tokens, session material, authorization headers, or complete credential payloads.

## Delegated and autonomous behavior

When a user requests an action and all required authority, funding, approvals, exact contract identity, and reviewed bounds already exist, execute without adding a redundant confirmation phrase or user gate.

Ask before performing an additional prerequisite that was not requested, including:

- minting, wrapping, or swapping an asset;
- bridging funds;
- granting a new approval, installing a signer, or expanding delegated authority;
- changing networks or contract targets;
- enabling an autonomous capability;
- substituting a materially different asset, basket, profile, or action.

Ambiguous identity is not permission to guess. Clarify whenever more than one wallet, network, contract, asset, basket, profile, action, or amount remains plausible.

## Transaction execution invariants

- Accept typed actions only. Never accept an arbitrary target or raw calldata from the browser for delegated execution.
- Verify the Privy access token, authenticated user, exact active wallet, Statics signer, expected policies, chain, contract, selector, and value bounds before signing.
- Rebuild transactions from fresh authoritative state, simulate immediately before signing, and use durable idempotency for server-broadcast actions.
- Keep approvals exact or bounded. Do not request unlimited spend by default.
- Treat onchain state as authoritative over cached, indexed, or cross-application data.
- Distinguish prepared, simulated, broadcast, confirmed, reverted, replaced, failed, and needs-user-action states.
- Do not report success from an HTTP response or transaction hash alone. Verify the receipt and resulting state.
- Preserve transaction hashes, operation IDs, wallet, chain, contract, typed action, and deterministic error codes needed for audit and support.

## Frontend and wallet behavior

- Preserve the last known good wallet, balance, quote, and protocol state during refreshes when safe; label stale or refreshing state clearly.
- Never replace valid data with a placeholder that implies data is missing.
- Keep onchain buttons single-submit and visibly pending while a request is in flight.
- Present one valid next action at a time: switch network, approve or permit, then execute.
- Display addresses, token amounts, USD values, network, contract target, fees, and slippage bounds unambiguously.
- Keep navigation to every implemented screen usable even when wallet, deployment, or RPC data is unavailable. Blank-data cards may use stable local route IDs solely to open their implemented detail screens.
- Disable only unimplemented or unknown external destinations and controls that would perform wallet, signing, or onchain work without their required data. Runtime unavailability must not block tabs, local selectors, form exploration, or navigation.
- Treat provider order and wallet context boundaries as application-critical; test wallet-dependent rendering under the real provider tree.

## Protocol and ABI changes

- Inspect the live protocol source in `../statics` before relying on this repository's plans or copied artifacts.
- Treat the protocol repository and this frontend as separate Git repositories. Confirm the exact repository before editing, testing, staging, or committing.
- Update the authoritative ABI or SDK source first, use the repository's sync workflow, and verify consumers and provenance metadata.
- Do not hand-edit generated ABI output without confirming the generation workflow.
- Keep production imports independent from sibling checkout paths.

## Configuration and secrets

- Public configuration may contain only values safe for the browser. Never use a `NEXT_PUBLIC_` prefix for secrets.
- Keep Privy app secrets, authorization private keys, database credentials, private RPC credentials, and monitoring secrets server-only.
- Production must fail closed when required wallet, signer, chain, contract, database, or policy configuration is missing.
- Redact tokens, signatures, authorization headers, and credential-bearing RPC URLs from logs and test artifacts.
- Do not commit `.env` files, private keys, local databases, build output, access tokens, or generated credential payloads.

## Files and Git hygiene

- Inspect `git status` before editing.
- Existing modified and untracked files belong to the user unless proven otherwise.
- Do not delete, revert, format, stage, or commit unrelated changes.
- Use `rg` and `rg --files` for discovery.
- Use `apply_patch` for intentional file edits.
- Do not create a commit unless the user asks for one.
- When asked to commit, stage only explicit paths belonging to the requested change.
- Inspect `git diff --cached --name-status` and the complete staged diff before committing.
- Confirm that generated files, snapshots, lockfiles, and documentation in the staged set are intentional.
- Never use destructive Git commands unless the user explicitly requests them and the exact target is verified.

## Documentation standards

- Label local findings as a current source baseline, not deployed-production fact.
- Date live API and network observations.
- Link primary documentation for external APIs and SDK behavior.
- Clearly distinguish documented, observed, inferred, simulated, locally verified, and live-network-verified facts.
- Keep `STATICS-DAPP-BUILD-PLAN.md` synchronized with implementation only when concrete evidence supports the update.
- Do not mark deployment, integration, fork, or live-network gates complete from unit tests or scaffolding.
- Prefer an executable fixture or regression beside important integration specifications.

## Commit messages

Use Conventional Commits with a title no longer than 72 characters:

```text
feat(scope): short summary

- Useful implementation detail
- Rationale or verification context
```

Use only meaningful bullets. Do not mention completion bookkeeping. When presenting a suggested commit message in chat, wrap it in a fenced `text` block.
