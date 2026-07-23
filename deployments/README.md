# Statics deployments

There is no checked-in public Statics Dollar deployment yet.

Local Anvil deployments are generated into ignored environment state and are accepted only when
`NEXT_PUBLIC_APP_ENV=development` and the deployment chain is `31337`. Staging and production must
use a reviewed, checked-in manifest that binds every address to its runtime code hash and protocol
commit before those networks can expose transaction actions.
