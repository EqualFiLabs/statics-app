# ADR: Network-aware Statics Operators launch application

- Status: Accepted
- Date: 2026-08-19
- Scope: Statics application behavior before the full protocol Diamond is available
- Replaces: `dual-state-launch-application.md`

## Context

Statics will operate the same standalone Genesis launch on Robinhood Chain mainnet and testnet.
The existing testnet protocol deployment will be replaced; it is not a second product environment
that must coexist with the launch application.

The application already has wallet-network controls, an EVM swap card in the Portal, launch
manifests, runtime verification, Genesis contracts, Ponder, and a local Robinhood fork harness.
The launch UI should reuse those facilities instead of creating separate deployment and trading
applications.

The local fork exists to make unfinished UI iteration easy. It runs the same application against
realistic Robinhood state and will be removed from production configuration when no longer needed.

## Decision

### One application selected by network

Robinhood mainnet and testnet use the same routes and components. The existing network control
selects the target chain and wallet network. There is no separate deployment selector, deployment
URL parameter, or deployment preference in browser storage.

Each network target may have a reviewed launch deployment, a full-protocol deployment, both, or
neither. Chain and manifest identity remain part of internal cache and database keys so records
cannot cross networks. This internal isolation is not exposed as a second product-selection model.

The Overview is organised around the Genesis Epoch. `genesisEpochEnd` is immutable and changes three economics the moment it passes — acquisition gains a reserve buy-in, redemption begins paying a reserve share, and secured credit opens — so it leads the page as a live countdown stating what changes, rather than as one metric tile among many. Because the reserve accrues acquisition fees during the Epoch, the buy-in owed at the boundary is always quoted from the current reserve and labelled as rising, never as a settled future price. Below it the page reports the wallet's own position, the fixed 5,555 supply as one division, the market price with the Genesis backing valued against it, and the three solvency invariants the Vault enforces — verified client-side from the custody figures `vaultAccounting` already returns.

Launch deployments expose only three primary product destinations: Overview, Trade, and My Genesis. Wallet, Activity, and Approval Tools remain contextual utilities reachable from product flows; funding Portal access remains contextual through Wallet. Unsupported known full-protocol URLs replace to `/app`, while unknown `/app/*` paths remain Next.js 404s. Full-protocol deployments restore the complete application catalog and its existing route behavior.

The network selector uses stable target identities rather than treating a deployment as a second
environment selector:

```text
Local Anvil             31337
Robinhood Chain          4663
Robinhood Chain Testnet 46630
```

Development builds expose all three targets from one running application. Production builds omit
Local Anvil. Selecting a target changes its RPC, manifests, indexer identity, wallet target chain,
and query namespace together.

### Swap page reuses the Portal swap card

The application has one dedicated Swap page with a two-option selector:

```text
Token | NFT
```

Token mode reuses the Portal EVM swap card and limits it to ETH, WETH, and STATICS. STATICS pairs
are quoted and executed directly through the reviewed canonical Uniswap v4 `PoolKey`. It reuses the
existing amount, balance, slippage, review, approval, wallet, error, and confirmation behavior.
The dedicated Swap page does not show bridge or Solana controls.

The Portal retains its broader funding experience. Its EVM swap card gains the same canonical
STATICS route while unrelated pairs continue through the existing routing service.

NFT mode is the Genesis Vault conversion surface:

- show the next available Genesis NFT and its image;
- exchange the fixed STATICS backing amount plus the native acquisition fee for that NFT;
- allow an owned Genesis NFT to be redeemed for the fixed STATICS backing amount; and
- continue directly from a required maximum approval into the requested acquisition or redemption.

There is no Genesis inventory catalog and no user-facing pagination over 5,555 NFTs.

Genesis management is the My Genesis destination, and it consolidates ownership, activation, credit, and launch rewards into one surface. The destination opens with a wallet summary — holdings, aggregate backing, everything claimable, and any credit outstanding with its nearest maturity — before any single NFT. Owned NFTs are then a single-row carousel that pages horizontally rather than wrapping, each card carrying its artwork and a status flag for registration, pending rewards, and an active credit lock; past twelve NFTs a filterable grid replaces the carousel. The selected NFT splits into its identity — artwork at full size, derived traits read from the token metadata document, backing, and reward weight — and one action panel at a time behind an Activate / Rewards / Credit control, so each of the three decisions is presented on its own.

Activation presents the whole tier ladder rather than a tier picker, because the multiplier curve flattens after the first tier and the trade-off is only legible when every rung is visible. Secured credit presents the term, the grace period, and the recoverable window as one timeline with a live position marker, and states the recovery consequence before the borrow control rather than after it.

Permissionless recovery moved to `/app/genesis/recoveries`, its own destination: it is keeper work rather than Genesis ownership, and it remains reachable without owning a Genesis or connecting a wallet. Every indexed candidate is revalidated onchain before a recovery action. The former `/app/genesis-rewards` route redirects to `/app/genesis`.

### Event-derived Genesis indexing

All 5,555 Genesis NFTs are minted sequentially to the Vault. Ponder therefore treats Vault
ownership as the implicit initial state and does not expand the ERC-2309 `ConsecutiveTransfer` into
5,555 identical rows.

Ponder stores circulating ownership changes plus activation, registration, fee, and reward events.
A transfer back to the Vault removes the circulating ownership row. The next available token ID is
derived from the bounded collection and circulating exceptions. It is authoritative only while the
Ponder checkpoint is within 100 blocks of the RPC head, and the returned candidate is rechecked
against `isVaultInventory(tokenId)` before acquisition. A fresh `null` response means the Vault is
exhausted. An unavailable or stale response means inventory is syncing and must never be presented
as exhaustion. The application does not scan all 5,555 IDs as a fallback.

Wallet discovery starts from Ponder's ownership snapshot. When its checkpoint is healthy enough to
reconcile, the application requests `Transfer` logs once for at most the next 50,000 blocks and then
rechecks every resulting candidate with `ownerOf`. If the checkpoint is unavailable, is ahead of the
RPC, or trails by more than 50,000 blocks, the indexed snapshot remains visible but is marked stale;
the application does not replay the collection's full history. A stale empty snapshot is presented
as syncing rather than as proof that the wallet owns no Operators.

### Local fork

The local Robinhood fork runs the same Swap, Genesis, rewards, wallet, and Ponder paths used by
public networks. It must be convenient for iterative browser testing and appears in the existing
network selector as **Local Anvil**, not as a deployment mode.

The harness initially reports Robinhood chain ID `4663` while the standalone contracts are
deployed so the reviewed Doppler module configuration remains exact. Before Ponder and the app
start, the harness changes the local Anvil identity to `31337`. This makes Local Anvil, Robinhood
mainnet, and Robinhood testnet independently selectable without an RPC collision.

Only these fork-specific protections remain:

- the RPC must be loopback-only;
- the generated manifest is accepted only in development; and
- runtime bytecode and canonical bindings are verified before the generated local manifest is
  accepted.

The local manifest adds the Anvil target; it never replaces the public targets. The fork does not
create a user-visible deployment mode, replace pages, or disable canonical swaps.

## Invariants

1. Every value-moving launch action is bound to the selected network and reviewed manifest.
2. Canonical STATICS swaps use the exact manifest `PoolKey`, Quoter, Universal Router, Permit2, and
   runtime hashes.
3. A general Portal route cannot silently replace the canonical STATICS route.
4. NFT acquisition rechecks that the displayed token is still Vault inventory before submitting.
5. Genesis redemption remains subject to ownership, approval, activation-lock, and backing checks.
6. Mainnet, testnet, and local-fork indexed records cannot collide.
7. Launch primary navigation is Overview, Trade, and My Genesis; contextual Wallet, Activity, Approval Tools, and Genesis recoveries remain reachable; unsupported known full-protocol URLs replace to `/app`, unknown paths remain 404s, and full-protocol stage restores the complete catalog.
8. Every dapp route states its own name and purpose; the route header is not reserved for the overview.
9. Local-fork support cannot be enabled outside development or against a non-loopback RPC.
10. Ponder is authoritative for Genesis discovery; bounded RPC reconciliation can confirm recent
    wallet changes but cannot replace a missing or stale index.

## Consequences

The application has one product model and one set of launch components across networks. The Portal
and dedicated Swap page share token-swap behavior, Genesis acquisition is a single next-inventory
flow, and Ponder stores only meaningful state transitions. The future full protocol can enable its
existing navigation destinations without introducing compatibility layers for the superseded
testnet deployment.
