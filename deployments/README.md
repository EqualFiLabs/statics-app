# Statics deployments

Each public network is described by a reviewed manifest in this directory,
`<chainId>.json`, binding every contract address to the runtime code hash that
was deployed at it and to the recorded deployment commit. The `source` block
also names the reachable public Statics commit and canonical deployment artifact
that preserve the public provenance record without relabeling deployed bytecode.

The prior Robinhood deployment used the obsolete schema and has intentionally
been removed. The next `46630.json` will be generated after the Genesis release
is deployed. It will bind the unified Statics deployment, fixed STATICS token,
Genesis NFT/renderer/avatar stack, USDG profile, and Robinhood Uniswap v4
dependencies to their runtime code hashes.

## Generating one

Manifests are generated from a live deployment, then committed:

```
npm run deployment:manifest -- \
  --rpc https://rpc.testnet.chain.robinhood.com \
  --addresses /path/to/current-deployment-addresses.json \
  --commit <40-character recorded deployment commit> \
  --public-commit <40-character public Statics commit> \
  --source-repository https://github.com/EqualFiLabs/statics \
  --deployment-artifact deployment.md \
  --network "Robinhood Chain Testnet" \
  --start-block <block the diamond was deployed in> \
  --weth-profile 1 \
  --pegged-profile 2        # optional, only where USDG is deployed
```

The address input is the operator's current deployment record. The public
deployment artifact is the reviewed provenance record in the Statics repository;
it can be either `deployment.md` or a JSON record under `deployments/`. Every
runtime code hash is read from the chain. Generation also records the STATICS
token, Genesis collection, Genesis renderer, and Avatar SVG contracts. Runtime
verification checks their Diamond and renderer bindings, so a stale or
inconsistent metadata stack fails closed.

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
