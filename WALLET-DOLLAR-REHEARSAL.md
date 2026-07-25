# Wallet and Dollar Rehearsal

This checklist proves the interactive behavior that automated tests cannot establish: the same
Privy identity resolves to the same embedded EVM wallet in Statics and Eves, the applications keep
independent sessions, and the Statics UI completes a real Dollar lifecycle against ephemeral local
contracts.

This is a local rehearsal only. It does not authorize a Robinhood Testnet deployment or transaction.
Do not commit credentials, full wallet addresses, screenshots containing login details, or
`.env.local`.

## Prerequisites

1. Add the exact Statics development origin to the existing Privy application.
2. Copy only Eves' public `NEXT_PUBLIC_PRIVY_APP_ID` and, when configured,
   `NEXT_PUBLIC_PRIVY_CLIENT_ID` into this repository's ignored `.env.local`.
3. Never copy Eves authorization keys, delegated signer identifiers, policy data, app secrets,
   cookies, access tokens, or server environment values.
4. Have an external browser wallet available for the connection smoke test.
5. Start a fresh Anvil node on chain `31337`, then deploy the local Dollar stack:

   ```bash
   PRIVATE_KEY=<funded-anvil-development-key> npm run deploy:dollar:local
   npm run dev
   ```

   The deployment helper preserves existing Privy values in `.env.local`, writes only public local
   deployment data, and refuses non-Anvil chains.

## Embedded-wallet identity proof

1. Sign into Eves and Statics independently with the same Privy credential.
2. In each application, select the Privy embedded EVM wallet rather than an external wallet.
3. Compare the complete checksum addresses on screen. Record only whether the exact comparison
   matched; do not paste the full address into tracked evidence.
4. Sign out of Statics and confirm the Eves session remains signed in.
5. Sign back into Statics and confirm the same embedded address is restored.

## Local embedded-wallet Dollar flow

The browser wallet needs local ETH and WETH. Use Anvil fixture controls only; never perform these
steps on a public RPC.

1. Fund the embedded address with local ETH.
2. Create local WETH for that same address using the deployed fixture WETH contract. This is a
   fixture prerequisite, not a Statics protocol action.
3. In `/app/dollar`, confirm the exact embedded address, wallet type, Local Anvil network, verified
   gateway, WETH profile mode, health, series state, pause mask, and exit state.
4. Complete an ETH deposit. Confirm the activity moves through simulation, signature, submission,
   and receipt confirmation, then verify the resulting Dollar and Risk balances.
5. Recombine the resulting pair to ETH:
   - Approve the exact Dollar amount.
   - Review the all-series scope, then approve the Risk operator.
   - Confirm the recombination receipt and resulting balances.
6. Complete a WETH deposit:
   - Reject the first exact WETH approval and confirm activity records `Rejected`, not `Reverted`.
   - Retry the exact approval, deposit WETH, and confirm Dollar/Risk balances.
7. Recombine the resulting pair to WETH and confirm the WETH output.
8. In the Dollar section of `/app/portal`, mint Statics Dollar with the local USDG fixture:
   - Approve only the bounded USDG amount shown by the fresh quote.
   - Confirm the mint receipt and resulting USDG and Statics Dollar balances.
   - Redeem a subset with an exact Statics Dollar approval, then confirm the receipt and balances.
9. Revoke the Risk operator and verify the authoritative approval state refreshes.
10. Confirm `/app/activity` is scoped to the embedded wallet identity, identifies the exact network
    for every row, displays final receipt hashes, and does not create explorer links for Anvil.

## External-wallet smoke test

1. Sign out of Statics, choose **Connect wallet**, and select an external wallet.
2. Confirm Statics shows the external address and wallet type without substituting the embedded
   wallet.
3. Switch the wallet to Local Anvil from the Statics control.
4. Reject a signature request and confirm the inline and activity states remain actionable.
5. Disconnect or sign out, then confirm no stale external address remains.

The external wallet does not need to repeat the Dollar lifecycle.

## Evidence record

Record the date, browser/wallet versions, local protocol commit, local site commit, and these
boolean outcomes:

- Statics and Eves exact embedded addresses matched.
- Statics logout left the Eves session intact.
- Embedded ETH deposit/recombination passed with confirmed receipts and expected balances.
- Embedded WETH deposit/recombination passed with exact approvals and expected balances.
- Embedded pegged USDG mint/redemption passed with bounded approvals and expected balances.
- Wallet rejection, activity history, and Risk operator revocation passed.
- External connect, chain switch, rejection, and disconnect passed.

Mark the interactive wallet gate complete in `STATICS-DAPP-BUILD-PLAN.md` only after every outcome
above has been observed. Keep this local evidence separate from any later public-network evidence.
