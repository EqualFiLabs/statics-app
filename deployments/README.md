# Statics deployments

Each public network is described by a reviewed manifest in this directory,
`<chainId>.json`, binding every contract address to the runtime code hash that
was deployed at it and to the recorded deployment commit. The `source` block
also names the reachable public Statics commit and canonical deployment artifact
that preserve the public provenance record without relabeling deployed bytecode.

Robinhood Chain Testnet is recorded in `46630.json`. It binds the unified Statics
deployment, USDG profile, and Robinhood Uniswap v4 dependencies to their runtime
code hashes. The faucet entry is optional until its separately authorized live
deployment is recorded.

## Generating one

Manifests are generated from a live deployment, then committed:

```
npm run deployment:manifest -- \
  --rpc https://rpc.testnet.chain.robinhood.com \
  --addresses /path/to/statics/deployments/robinhood-testnet-46630-statics.json \
  --commit <40-character recorded deployment commit> \
  --public-commit <40-character public Statics commit> \
  --source-repository https://github.com/EqualFiLabs/statics \
  --deployment-artifact deployments/robinhood-testnet-46630-statics.json \
  --network "Robinhood Chain Testnet" \
  --start-block <block the diamond was deployed in> \
  --weth-profile 1 \
  --pegged-profile 2        # optional, only where USDG is deployed
```

Addresses come from the protocol's own deploy artifact and every runtime code
hash is read from the chain, so the file records what is deployed rather than
what was intended. An address with no code at it fails the generation instead of
producing a manifest that points at nothing.

The recorded deployment commit remains the identity used by the application for
cache separation. It may predate a public repository snapshot. The public commit
and deployment artifact make that relationship explicit and reviewable.

The command writes `<chainId>.json` and rewrites `manifests.ts` to match this
directory. Commit both. Do not hand-edit either: rerun the generator so the
registry and the JSON beside it cannot fall out of step.

## Why generated and committed rather than configured

Local Anvil is configured from environment variables, which is fine for a chain
that is recreated on demand. Everything else must come from a file in the
repository, so that pointing the app at different contracts is a diff somebody
approved rather than state on a build machine.

The manifest is only half the check. `verifyDollarDeployment` re-reads every
runtime code hash from the connected chain before any transaction path is
offered, so a manifest that has drifted from the chain fails closed.
