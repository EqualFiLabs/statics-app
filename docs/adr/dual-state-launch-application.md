# ADR: Dual-state Statics launch application with direct canonical trading

- Status: Accepted direction; implementation pending
- Date: 2026-08-19
- Scope: application deployment selection, standalone Genesis launch UX, direct
  STATICS/WETH trading, indexing, and coexistence with the Robinhood testnet
  protocol beta
- Application base: `feat/user-first-protocol-ux` / Statics App PR #26
- Protocol dependencies: the accepted Doppler Genesis architecture and its
  standalone-contract implementation

## Context

Statics will launch its protocol token and Genesis product on Robinhood Chain
mainnet before the complete Statics Diamond is launched there. At the same
time, the existing full-protocol beta will remain available on Robinhood Chain
testnet.

Those networks therefore expose different Statics products:

```text
Robinhood Chain mainnet
    |
    +-- STATICS/WETH Doppler market
    +-- Statics Genesis Vault
    +-- Genesis activation
    +-- Genesis launch rewards

Robinhood Chain testnet
    |
    +-- Statics Dollar
    +-- baskets
    +-- PositionNFTs
    +-- lending
    +-- protocol liquidity
    +-- protocol rewards
    +-- testnet faucet
```

The application currently assumes one configured Statics chain per production
build. Its deployment model begins with a complete Dollar deployment and treats
Genesis as an optional extension of the Diamond. Its Genesis page reads and
writes Diamond state, links Genesis NFTs to PositionNFTs, and does not expose
standalone vault or launch-reward operations.

The existing general-purpose Portal swap also cannot be the launch's only
STATICS acquisition path. It relies on a hosted routing API, which may not
discover a newly initialized Doppler pool immediately and does not support
Robinhood Chain testnet. A user who does not own STATICS also has no dependable
way to select it from the current default token catalog.

The application must make the canonical launch market directly usable while
preserving the Portal for general funding, bridging, and aggregated trading.

This ADR changes application architecture only. It does not ratify Doppler
curve ranges, swap fees, Genesis reward percentages, production contract
addresses, or governance accounts. Those remain protocol deployment decisions
recorded in reviewed manifests.

## Decision summary

The Statics application will become a single multi-deployment application with
an explicit active Statics environment.

The initial production environments are:

| Environment             | Chain ID | Product stage             |
| ----------------------- | -------: | ------------------------- |
| Robinhood Chain         |     4663 | Standalone Genesis launch |
| Robinhood Chain Testnet |    46630 | Full-protocol public beta |

Navigation, pages, transactions, indexing, and status copy will be driven by
the selected deployment's declared capabilities rather than a single global
build-time network mode.

The application will provide a dedicated direct canonical trade page for the
STATICS/WETH launch pool. The hosted Uniswap Trading API remains an optional
general-purpose Portal integration and is not required for launch-market
availability.

The standalone Genesis page will be rebuilt around the permanent Genesis
collection, Vault, Activation Registry, Fee Receiver, and launch Distributor.
PositionNFT linking will appear only in a deployment where the full-protocol
Genesis integration is available.

## Deployment model

### Deployment identity

Every public Statics environment is represented by a checked-in reviewed
manifest. A deployment identity contains at minimum:

```text
chain ID
product stage
deployment identifier
protocol repository commit
SDK repository commit
deployment start blocks
contract addresses
runtime code hashes
capabilities
```

The application will distinguish two independent deployment shapes.

```text
LaunchDeployment
    |
    +-- STATICS
    +-- WETH
    +-- StaticsGenesis
    +-- StaticsGenesisVault
    +-- GenesisActivationRegistry
    +-- GenesisLaunchDistributor
    +-- StaticsFeeReceiver
    +-- allocation escrow
    +-- Genesis renderer and avatar renderer
    +-- Doppler pool initializer
    +-- canonical PoolKey and PoolId
    +-- PoolManager
    +-- V4Quoter
    +-- Universal Router
    +-- Permit2

ProtocolDeployment
    |
    +-- Diamond and facets
    +-- Dollar contracts
    +-- basket and PositionNFT integration
    +-- protocol liquidity dependencies
    +-- optional testnet fixtures and faucet
```

A chain may eventually expose both shapes. The model must therefore describe
capabilities explicitly instead of assuming that chain ID alone determines
which product exists.

### Capability-driven surfaces

Initial capabilities include:

```text
canonicalStaticsMarket
genesisVault
genesisActivation
genesisLaunchRewards
genesisPositionLinking
dollar
baskets
positions
loans
protocolLiquidity
protocolRewards
faucet
```

A route is enabled only when its required capability is present. Deep links to
an unavailable route show a clear explanation and a link to the environment
where that product is available; they must not render a broken transaction
surface.

### Runtime environment selection

Production wallet configuration will support Robinhood mainnet and Robinhood
testnet in the same build. The user selects the active Statics environment and
the application asks the wallet to switch when necessary.

The environment selection is application state, distinct from the Portal's
origin-network selection. Choosing Base as a bridge origin must not silently
change the active Statics deployment.

The selected environment is persisted locally and may be represented in the
URL so shared deep links retain their intended chain. Robinhood mainnet is the
default public launch environment. Testnet is always marked visibly as
testnet.

The application must not combine values from different deployments in one
portfolio total or transaction flow.

### Reviewed manifests remain authoritative

Public contract addresses do not come from arbitrary build-machine environment
variables. Mainnet and testnet manifests are committed and reviewed. Runtime
RPC and indexer URLs may remain environment configuration, but they resolve a
known chain and may not replace manifest contract identities.

Before enabling a value-moving action, the application verifies relevant
runtime code hashes and critical bindings. Launch verification includes at
minimum:

1. the connected chain matches the selected deployment;
2. the STATICS, Genesis, Vault, Registry, Distributor, and Fee Receiver code
   hashes match the manifest;
3. the Genesis collection reports the manifest Vault and Activation Registry;
4. the Fee Receiver reports the manifest STATICS, WETH, pool initializer, and
   PoolId;
5. the Distributor reports the manifest Fee Receiver, Genesis collection,
   Activation Registry, treasury, STATICS, and WETH;
6. the canonical PoolKey resolves to the recorded PoolId; and
7. Quoter, Universal Router, Permit2, and PoolManager bindings match the
   reviewed Robinhood dependency manifest.

The application fails closed if these checks do not pass.

## Direct canonical STATICS trading

### Dedicated trade surface

The application will add a prominent `Trade` or `Buy STATICS` route. It is a
primary launch action, not a secondary option hidden inside the funding Portal.

The direct trade surface supports:

```text
ETH   -> WETH -> STATICS
WETH  -> STATICS
STATICS -> WETH
STATICS -> WETH -> ETH
```

Native wrapping and unwrapping should occur inside the reviewed Universal
Router flow where Robinhood's deployed router supports it. The user should not
need to visit a separate wrapping tool before buying STATICS.

The interface displays:

- exact input;
- quoted output;
- minimum received;
- slippage tolerance;
- price impact;
- current pool price;
- the configured static pool fee;
- estimated network cost;
- token balances;
- approval state; and
- the canonical pool identity.

### Direct execution

The launch trade implementation reuses the application's existing canonical
V4 swap primitives rather than the hosted Trading API transaction builder.

For every swap it will:

1. load the exact PoolKey from the reviewed launch manifest;
2. quote the exact input through the reviewed V4Quoter;
3. determine direction from resolved currency ordering rather than assuming
   whether STATICS is currency0 or currency1;
4. calculate a protected minimum output from the user's slippage setting;
5. refresh balances, allowances, block time, and the quote immediately before
   execution;
6. reject execution if the refreshed quote falls below the reviewed minimum;
7. execute through the reviewed Universal Router;
8. wait for confirmation; and
9. verify the recipient's output balance increased by at least the protected
   minimum.

### Approval policy

The direct launch market follows the existing canonical-swap approval policy:

```text
input ERC-20 -> Permit2
    maximum ERC-20 allowance on first use

Permit2 -> reviewed Universal Router
    maximum Permit2 allowance and expiration on first use
```

The application verifies both confirmed allowances and exposes them in the
approval Tools page. It does not request a new ERC-20 approval for every swap.

Native ETH input does not require an ERC-20 approval.

### Aggregator role

The hosted Uniswap Trading API remains available in the Portal for general
token routing where supported. It may later provide an alternative best-route
option for STATICS after the pool is indexed, but it is never the sole or
required route to the canonical launch pool.

The direct route is always available when the canonical-market capability is
enabled and the verified Robinhood dependencies are healthy.

## Standalone Genesis experience

The mainnet Genesis route contains three primary views.

### Explore the Vault

Users can:

- browse the Genesis NFTs held by the Vault;
- search and navigate by token ID;
- open full-size onchain artwork;
- view the live fixed STATICS acquisition price;
- view the current native acquisition fee;
- see their STATICS and ETH balances;
- approve the Vault for the required STATICS; and
- acquire a selected NFT to themselves.

The application reads `quoteGenesisPurchase()` again immediately before
submission. Neither the fixed STATICS price nor the configurable native fee is
trusted from cached indexer state.

The interface explains that the deposited STATICS becomes immutable Genesis
backing and is not treasury revenue. It describes the redemption claim as a
STATICS-denominated mechanical floor, not a fixed ETH or fiat floor.

### My Genesis NFTs

For each owned Genesis NFT the application displays:

- token ID and full-size artwork;
- registration status;
- activation tier and multiplier;
- cumulative cost to activate through each higher tier;
- pending launch rewards by asset;
- transfer lock status when the full protocol is bound; and
- redemption value.

Available owner actions are:

```text
register for launch rewards
activate through a selected tier
claim Genesis-bound STATICS rewards
claim Genesis-bound WETH rewards
redeem through the Vault
transfer when unlocked
```

Registration is an explicit post-acquisition action because the standalone
contracts do not automatically register the buyer. The acquisition success
state leads directly to registration.

Activation approvals target the permanent Activation Registry. Vault purchase
approvals target the Vault. They are not Diamond approvals.

### Launch rewards

The rewards view displays:

- the configured Genesis reward share;
- total registered reward weight;
- per-asset reward-book totals;
- cumulative Fee Receiver harvests;
- pending rewards for each owned registered NFT;
- prior-owner claimable balances crystallized during transfer; and
- the last indexed accrual point.

The Distributor's permissionless `accrue()` operation is exposed as an
`Update rewards` action. It is not automatically submitted merely because a
page rendered. Claims may perform their own current accrual according to the
contract behavior.

Previous-owner rewards remain claimable even after the wallet no longer owns
the NFT. The application queries and presents these balances independently of
the current NFT portfolio.

### Transfer and redemption semantics

Before an owner-changing transfer, the application clearly states:

```text
Transferring this Genesis NFT resets its activation to Tier 0.
Rewards earned before transfer remain claimable by the previous owner.
```

When a Genesis is linked to a PositionNFT in a later full-protocol deployment,
the interface also explains that it must be unlinked before transfer.

Redemption must call the Vault's redemption function. The application must not
present a plain transfer to the Vault as redemption, because a direct NFT
transfer does not execute the STATICS payout.

### Later PositionNFT integration

The standalone mainnet view does not ask for a PositionNFT and does not show a
linking control. Once a deployment declares `genesisPositionLinking`, the
PositionNFT section is added without replacing the Vault, Registry, or
historical launch-reward views.

## Application navigation and overview

### Mainnet launch navigation

The standalone launch presents only usable products:

```text
Overview
Trade
Genesis NFT
Wallet
Add funds
Activity
Approval tools
```

Dollar, baskets, PositionNFTs, loans, full-protocol liquidity, and the faucet
are omitted from mainnet launch navigation until their capabilities are
available.

### Testnet navigation

Robinhood testnet retains the current full-protocol routes and faucet. It also
uses explicit testnet badges in the header, route copy, transaction review, and
activity history.

### Stage-aware overview

The mainnet overview focuses on the product that is actually live:

- STATICS balance;
- current canonical-market price;
- pool volume and liquidity information available from indexed data;
- Genesis Vault inventory and circulating count;
- Vault backing and required backing;
- registered Genesis count and weight;
- pending wallet rewards;
- cumulative Statics fee revenue; and
- primary `Buy STATICS` and `Explore Genesis` actions.

The testnet overview retains the complete protocol portfolio.

Static site status copy is replaced with deployment-aware status. A mainnet
launch must not describe itself as `Public testnet beta`, and testnet must not
be presented as mainnet.

## Wallet and funding

STATICS and WETH from the active launch manifest are always included in the
mainnet wallet token catalog, even when the connected wallet holds zero
STATICS. Token discovery cannot depend on already owning the launch token.

The wallet NFT view includes the canonical Genesis collection automatically.
It does not require the user to add the collection manually and does not
require a full Dollar deployment merely to show Genesis holdings.

The Portal's preferred destination follows the active Statics deployment.
During the standalone launch it guides users toward ETH or WETH on Robinhood
mainnet rather than requiring a pegged-Dollar deployment. The Portal remains a
funding surface; the dedicated Trade page performs the final canonical
STATICS purchase.

Activity records include chain ID, deployment identity, contract, action type,
and transaction hash. Mainnet and testnet histories are filterable and are
never merged as though they were actions against the same contracts.

## Indexing

The current single-network Genesis index is replaced with deployment-aware
indexing.

Indexer entity identity includes at least:

```text
chain ID + deployment ID + contract address + entity ID
```

This prevents Genesis `#1`, PositionNFT `#1`, or another numeric identifier on
mainnet from colliding with its testnet counterpart.

The launch index covers:

- Genesis `ConsecutiveTransfer` and `Transfer` ownership;
- Vault purchases and redemptions;
- current Vault inventory;
- activation tier changes and resets;
- Genesis registration and weight changes;
- launch revenue accrual;
- Genesis-bound claims;
- previous-owner claims;
- Fee Receiver harvests and distributor transitions; and
- canonical pool swaps needed for price, volume, and market history.

The frontend selects an indexer endpoint by active deployment. A single
multi-chain service or isolated per-network instances are both acceptable
operationally, but the API responses and cache keys always identify chain and
deployment.

Indexer data is discovery and history, not transaction authority. Before a
transaction, the application re-reads ownership, current tier, price, native
fee, registration, claimable balances where required, and contract bindings
from the selected chain.

If the indexer is unavailable or behind, the application reports that state
and retains bounded direct reads such as exact token-ID lookup, balances,
quotes, and owned-item actions already known to the user. It does not present
stale indexed data as current onchain truth.

## Cache and state isolation

Every query key and persistent record that can vary by deployment includes:

```text
chain ID
deployment ID or protocol commit
wallet address where applicable
entity identifier
```

This applies to Genesis portfolios, reward books, token catalogs, wallet NFT
collections, transaction activity, approvals, pool quotes, and protocol
portfolios.

Switching from mainnet to testnet may retain previous data visually only as an
explicit loading placeholder. It must not render mainnet values under a
testnet heading or vice versa.

## Security and correctness requirements

The implementation and release tests must establish:

1. A mainnet transaction cannot use a testnet contract address or cached
   testnet quote.
2. A testnet transaction cannot use a mainnet contract address or cached
   mainnet quote.
3. Unsupported routes cannot prepare or submit transactions.
4. The faucet is unavailable on mainnet.
5. Direct swaps are hard-bound to the reviewed PoolKey, Quoter, Permit2, and
   Universal Router.
6. STATICS/WETH currency ordering is derived and verified, not assumed.
7. A swap quote is refreshed before submission and may not execute below the
   reviewed minimum output.
8. Confirmed direct swaps verify output-token balance deltas.
9. Maximum approval transactions are sent only to reviewed Permit2 and Router
   addresses and are represented in Approval Tools.
10. Native ETH wrapping and WETH unwrapping cannot strand user funds in an
    application-owned contract.
11. Vault purchase uses the latest onchain STATICS price and native fee.
12. Vault redemption uses `redeemGenesis`; a direct NFT transfer is never
    labeled redemption.
13. Activation reads cumulative tier costs from the Registry and cannot spend
    more than the reviewed target cost.
14. Launch registration cannot be confused with activation or PositionNFT
    linking.
15. Pre-transfer rewards remain visible and claimable by the previous owner.
16. Indexer lag cannot authorize a transaction or override current onchain
    ownership and price.
17. Mainnet and testnet cache, activity, token, NFT, and reward identities are
    isolated.
18. A manifest or runtime-code mismatch disables affected transactions and
    explains the failure.

## Required verification

### Application tests

- manifest parsing and runtime-binding validation for both deployment shapes;
- capability-driven navigation and route guards;
- mainnet/testnet environment switching;
- chain-qualified query and persistence keys;
- direct quote direction for either token ordering;
- slippage and refreshed-minimum protection;
- maximum ERC-20 and Permit2 approval behavior;
- native wrap, direct WETH trade, and native unwrap transaction construction;
- output-balance confirmation checks;
- Vault acquisition and redemption transaction construction;
- registration, activation, Genesis claim, and prior-owner claim flows;
- indexer lag, outage, malformed data, and chain mismatch handling; and
- stage-aware overview, status, wallet, Portal, and faucet behavior.

### Protocol fork proof required by the application

Before enabling mainnet trading, the protocol integration suite must create the
Doppler market on a Robinhood mainnet fork and exercise the production-shaped
path through Robinhood's deployed V4Quoter, Permit2, and Universal Router.

The proof must cover:

```text
WETH -> STATICS
STATICS -> WETH
ETH -> STATICS, if native wrapping is exposed
STATICS -> ETH, if native unwrapping is exposed
```

For each direction it must compare the quote to actual output, enforce minimum
output, verify exact wallet balance changes, and prove resulting Doppler fees
can be harvested and accrued to launch rewards.

A test using `PoolSwapTest` proves pool-level swap behavior but does not by
itself prove the production frontend Router path.

### Browser verification

Release verification includes browser execution at desktop and representative
mobile widths for:

- new wallet and existing wallet;
- mainnet and testnet selection;
- wrong-network recovery;
- direct buy and sell review;
- first approval and subsequent approval-free swap;
- Genesis inventory browsing and full-size artwork;
- purchase, registration, activation, claims, and redemption;
- prior-owner rewards after transfer;
- indexer unavailable and delayed states; and
- mainnet routes never showing faucet or unsupported full-protocol controls.

Executed local, fork, browser, testnet, and mainnet evidence must be reported
separately.

### Development-only Robinhood fork harness

The application may accept a generated launch manifest only when both
`NEXT_PUBLIC_APP_ENV=development` and `NEXT_PUBLIC_APP_NETWORK=robinhood-fork`. The manifest is
process-local, identifies chain 4663 as a local fixture, and includes a runtime-code hash for every
address consumed by the launch application. It is never a substitute for the reviewed production
manifest.

Because the local fork and Robinhood mainnet intentionally share chain ID 4663, chain ID alone is
not a sufficient wallet-safety boundary. Before submitting a fixture transaction, the application
must read the fixture STATICS runtime through the signer wallet's provider and compare it to the
generated manifest. A wallet still connected to public Robinhood therefore fails closed even though
its chain ID appears correct. Explorer links, third-party aggregator swaps, and external bridges are
disabled for the fixture; the direct canonical market remains available.

The supported local proof is one coordinator command that starts a loopback-only Robinhood fork,
deploys the standalone launch contracts through the production-shaped Doppler initializer, starts an
isolated Ponder instance, waits until all 5,555 vault-owned Genesis NFTs are indexed, and starts the
application with the generated manifest. Its control socket exposes only status, bounded wallet
funding, and bounded round-trip canonical trading. Fork funds are explicitly test-only, and the
upstream RPC credential remains server-side.

## Implementation sequence

The work should be delivered in bounded slices on top of Statics App PR #26.

### Slice 1: Deployment and capability foundation

- introduce launch and protocol deployment schemas;
- add chain/deployment selection state;
- support both Robinhood chains in one production wallet configuration;
- isolate queries, storage, and activity by deployment; and
- make navigation and route guards capability-driven.

### Slice 2: Direct canonical Trade

- extract reusable direct V4 quote and execution logic from canonical basket
  swaps;
- add reviewed launch-pool configuration;
- implement WETH/STATICS buy and sell;
- implement safe native wrap and unwrap paths;
- preserve reusable maximum approvals and Approval Tools integration; and
- add the prominent Trade route and launch calls to action.

### Slice 3: Standalone Genesis and SDK synchronization

- update the vendored SDK from the accepted standalone Genesis SDK release;
- replace Diamond Genesis reads and writes with Vault, Registry, Distributor,
  and Fee Receiver integration;
- implement Explore, My Genesis, and Launch Rewards views; and
- retain full-protocol Position linking only behind its capability.

### Slice 4: Multi-deployment indexing

- index standalone Genesis, reward, receiver, and market events;
- isolate mainnet and testnet entity identity;
- expose inventory, wallet, reward, and market endpoints; and
- add explicit lag and degraded-mode handling.

### Slice 5: Launch overview, wallet, and funding

- make `/app` stage-aware;
- add launch metrics and calls to action;
- include manifest STATICS, WETH, and Genesis automatically;
- retarget funding defaults to the active deployment; and
- replace hardcoded testnet status copy.

### Slice 6: Integrated release gate

- complete focused tests during each slice;
- run the production-router protocol fork proof;
- run full application verification once the implementation is complete;
- perform one consolidated security and UX review;
- remediate confirmed findings; and
- execute the final browser matrix against mainnet-fork/local and public
  testnet environments before a production cutover.

## Dependencies and rollout boundary

Implementation depends on:

1. acceptance of the Doppler Genesis ADR in the Statics protocol repository;
2. merge of the standalone Doppler Genesis contracts;
3. merge of the matching standalone Genesis SDK interfaces and builders;
4. ratification of the production Doppler fee and curve configuration;
5. successful Robinhood production-router fork proof;
6. deployment and verification of the mainnet standalone system; and
7. publication of the reviewed mainnet application manifest.

Application development may proceed using typed interfaces and fork-created
deployments before production addresses exist. Production transaction paths
remain disabled until the reviewed manifest and all runtime checks are present.

Robinhood's official Doppler configuration currently provides the mainnet
launch path, while the existing Robinhood testnet full-protocol deployment is a
separate product state. The application does not pretend that the testnet
Diamond deployment is an exact Doppler launch rehearsal. If an exact public
Doppler rehearsal is later required on another supported test network, it is
added as another manifest and capability set rather than a special-case UI.

## Consequences

### Positive

- Mainnet launch users receive a complete acquisition-to-reward journey.
- Trading remains available even before aggregator token discovery.
- The mainnet launch and testnet full protocol coexist in one application
  without misrepresenting which products are live.
- Future full-protocol mainnet activation is a capability and manifest update,
  not a second frontend rewrite.
- Contract addresses and transaction targets remain reviewed, reproducible,
  and fail-closed.
- Genesis launch rewards and previous-owner claims are visible without coupling
  them to PositionNFT ownership.

### Negative

- The application must support two deployment shapes and carefully isolate
  their state.
- Direct Universal Router integration requires more frontend and fork coverage
  than delegating all routing to a hosted API.
- Multi-deployment indexing and status monitoring add operational work.
- Native wrapping and unwrapping add execution paths that require explicit
  value-flow verification.
- The current Diamond-oriented Genesis page and deployment parser require
  replacement rather than small extensions.

## Rejected alternatives

### Deploy separate mainnet and testnet application builds

Rejected as the primary product model. Separate builds duplicate release state,
make shared links ambiguous, and make it harder for users to move between the
live launch and the protocol beta. One application with explicit environments
is clearer and easier to evolve.

### Keep one global `NEXT_PUBLIC_APP_NETWORK`

Rejected because a production build would support only one of the two required
Statics environments.

### Use the hosted Trading API as the only STATICS market

Rejected because launch availability would depend on external pool and token
discovery. The canonical pool is known and can be quoted and traded directly.

### Require users to wrap ETH manually

Rejected for the primary buy flow. The application should compose wrapping and
the canonical swap when the reviewed Universal Router supports it.

### Treat standalone Genesis as an optional Dollar deployment field

Rejected because the standalone launch intentionally exists without the
Diamond or Dollar contracts.

### Show every protocol route on every chain

Rejected because disabled or reverting pages make the mainnet launch appear
broken and can cause users to misunderstand which protocol components are live.

### Trust the indexer for transaction state

Rejected. Indexers provide discovery and history; current ownership, price,
fees, allowances, contract bindings, and claims are checked onchain before
value-moving actions.

## Governing principle

> One Statics application, multiple explicit deployment states, and no hidden
> dependency between access to the canonical launch market and third-party
> route discovery.

The application should always make the live Statics product obvious, directly
usable, and safely distinguishable from the product still being exercised on
testnet.
