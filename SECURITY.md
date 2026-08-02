# Security

## Release boundary

The checked-in public deployment is a Robinhood Chain Testnet beta. Repository tests, local
rehearsals, and the application review status do not authorize production or mainnet use. Always
verify the selected network, wallet, contract address, transaction bounds, and deployment runtime
hashes before signing.

## Reporting a vulnerability

Please report vulnerabilities through GitHub's private vulnerability reporting flow for this
repository. Do not open a public issue containing an exploit, credential, private RPC URL, wallet
session, authorization material, or complete affected-user address.

Include:

- the affected commit and route;
- the network and deployment manifest involved;
- reproduction steps or a minimal proof of concept;
- the expected and observed behavior;
- the potential impact; and
- any suggested remediation.

Do not move user funds, test against wallets you do not control, publish credentials, or interact
with public contracts beyond the minimum read-only evidence needed to describe the report.

## Supported versions

Security fixes target the current `master` branch and the deployment manifests checked into that
branch. Historical branches, local Anvil deployments, and unmerged pull requests are not supported
release channels.
