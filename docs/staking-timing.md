# Staking preview timing

The staking form uses `rewardSelectionWithTiming` on diamonds supporting
`IStaticsRewardSelectionTiming` (`0x13cfa782`). This replaces the existing
selection read for each selected asset; it does not add a second per-asset read.
Interface support is cached for five minutes by chain and diamond and shared
across positions. A failed supported getter makes the row unavailable rather
than silently substituting an estimated start.

The returned start is the pending stake's **weighted effective start**, including
previous top-ups. The preview applies the protocol's age-credit cap, integer
rounding and hourly eligibility bucket to calculate one projected maturity time
for each asset. Matured selections start a fresh pending tranche. The time
remains an estimate because signing, approvals and the transaction block can
advance the chain clock.

Older diamonds keep their existing selection reads. Without the weighted start,
pending top-ups retain a bounded time range based on the rounded deadline.
Genesis staking and existing reward claims keep their current bindings.

## SDK overlay

The getter is introduced by [statics #118](https://github.com/EqualFiLabs/statics/pull/118)
and [statics-sdk #40](https://github.com/EqualFiLabs/statics-sdk/pull/40).
The app overlays the position-market module from SDK revision
`498af5f864bbc8bbc9e5a65e68a182bf3b123898`, recording source and artifact checksums
in `vendor/statics-sdk/provenance.json`.

From a clean SDK checkout at that revision:

```sh
STATICS_REWARD_SELECTION_TIMING_SDK_REPOSITORY=/path/to/statics-sdk \
  node scripts/vendor-reward-selection-timing-sdk.mjs
```

Set this variable alongside the existing SDK source and batch-module variables
when running `npm run sdk:sync`. Sync refuses to silently remove an installed
timing module. This overlay preserves the other vendored compatibility modules.
