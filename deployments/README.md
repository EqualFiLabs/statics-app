# Statics deployments

Each public network is described by a reviewed manifest in this directory,
`<chainId>.json`, binding every contract address to the runtime code hash that
was deployed at it and to the protocol commit it was built from.

There is no checked-in public deployment yet. Until one exists the app reports
every non-local chain as unconfigured, which is the intended failure: a build
with no reviewed manifest offers no transaction path rather than guessing at
addresses.

## Generating one

Manifests are generated from a live deployment, then committed:

```
npm run deployment:manifest -- \
  --rpc https://rpc.testnet.chain.robinhood.com \
  --addresses ../statics/deployments/<network>.json \
  --commit <40-character protocol commit> \
  --network "Robinhood Chain Testnet" \
  --start-block <block the diamond was deployed in> \
  --weth-profile 1 \
  --pegged-profile 2        # optional, only where USDG is deployed
```

Addresses come from the protocol's own deploy artifact and every runtime code
hash is read from the chain, so the file records what is deployed rather than
what was intended. An address with no code at it fails the generation instead of
producing a manifest that points at nothing.

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
