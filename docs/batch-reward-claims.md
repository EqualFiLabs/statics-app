# Batch reward claims

Earn's **Claim all** includes positive staking rewards, LP Gauge Rewards,
LP bribes and allocator bribes across every indexed owned Position NFT. Discovery
includes retained pool rewards after an LP exit or allocation change. Operator
rewards and LP trading fees keep their individual controls.

Before review, the app checks the batch route's limits and simulates each complete
batch with the connected account at one block. The review shows the receiver,
aggregate minimum payouts and transaction count. Those payouts become the encoded
minimums; refreshed execution never lowers them. A changed wallet, network,
deployment or discovered position set invalidates the review.

The contract permits 16 groups and 64 asset/slot entries per transaction. The SDK
splits larger portfolios deterministically. Every transaction is atomic, but
separate transactions are independent. The app waits for a successful receipt
before requesting the next signature. A rejection, revert or context change
stops the sequence. Confirmed transactions remain visible in Activity; recovering
the remainder requires refreshing rewards and reviewing a new plan. Each receipt
uses the existing scoped reconciliation rather than another refresh schedule.

Incomplete position pagination or reward reads disable Claim all. Deployments
without `batchClaimLimits` retain the individual claim controls. The batch route
does not guarantee gas availability for arbitrarily large/token-heavy groups;
an estimation or settlement failure stops execution without weakening minimums.

## SDK compatibility

Batch claims require the protocol change in [statics #115](https://github.com/EqualFiLabs/statics/pull/115)
and the builders in [statics-sdk #37](https://github.com/EqualFiLabs/statics-sdk/pull/37).
The app vendors the batch module from SDK revision
`7621609f21c99e633b216199587cc810d1bb5c13` and records source/artifact checksums.
This overlay preserves the existing Genesis/Dollar and Phase 1 compatibility SDKs.

To reproduce the overlay from a clean SDK checkout:

```sh
STATICS_BATCH_REWARDS_SDK_REPOSITORY=/path/to/statics-sdk \
  node scripts/vendor-batch-rewards-sdk.mjs
```

When running the complete `sdk:sync`, set this variable as well as the existing
SDK source variables. Sync refuses to drop an installed batch module silently.

## Verification

Focused tests cover positive-balance selection, both limits, category separation,
retained rewards, incomplete discovery, exact reviewed minimums, receipt ordering,
partial failures and wallet changes. Browser/fork acceptance can stop at the
review; it does not require submitting real claims or clearing the test portfolio.
