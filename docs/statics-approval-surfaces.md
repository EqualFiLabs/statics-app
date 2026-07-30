# Statics approval surfaces

This map covers approvals created by the Statics application on its configured
Robinhood deployment. The Tools page derives the same token and spender set
from the verified deployment and live basket catalog.

| User flow                                     | Asset authority                       | Approved spender | Reusable policy                                                   |
| --------------------------------------------- | ------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| Mint a basket                                 | Each basket underlying                | StaticsDiamond   | Maximum ERC-20 allowance                                          |
| Deposit BasketTokens                          | BasketToken                           | StaticsDiamond   | Maximum ERC-20 allowance                                          |
| Mint into a position                          | Each basket underlying                | StaticsDiamond   | Maximum ERC-20 allowance                                          |
| Repay or extend a basket loan                 | Each principal asset                  | StaticsDiamond   | Maximum ERC-20 allowance                                          |
| Stake STATICS                                 | STATICS                               | StaticsDiamond   | Maximum ERC-20 allowance                                          |
| Increase staked v4 liquidity                  | Pool currencies                       | StaticsDiamond   | Maximum ERC-20 allowance                                          |
| Deposit WETH to Dollar                        | WETH                                  | Dollar Gateway   | Maximum ERC-20 allowance                                          |
| Recombine Dollar and Risk                     | USDstx                                | Dollar Gateway   | Maximum ERC-20 allowance                                          |
| Mint pegged Dollar                            | USDG                                  | Dollar Gateway   | Maximum ERC-20 permit on first use, existing allowance thereafter |
| Redeem pegged Dollar                          | USDstx                                | Dollar Gateway   | Maximum ERC-20 permit on first use, existing allowance thereafter |
| Redeem Dollar through supplied Risk liquidity | USDstx                                | Dollar Periphery | Maximum ERC-20 allowance                                          |
| Recombine Risk shares                         | ethLEV                                | Dollar Gateway   | ERC-1155 operator approval                                        |
| Supply consumable Risk shares                 | ethLEV                                | Dollar Periphery | ERC-1155 operator approval                                        |
| Canonical basket swap                         | Pool input token                      | Permit2          | Maximum ERC-20 allowance                                          |
| Canonical basket swap                         | Permit2 allowance for input token     | Universal Router | Maximum Permit2 allowance and expiration                          |
| Create v4 liquidity                           | Pool currencies                       | Permit2          | Maximum ERC-20 allowance                                          |
| Create v4 liquidity                           | Permit2 allowance for pool currencies | PositionManager  | Maximum Permit2 allowance and expiration                          |
| Stake a v4 liquidity position                 | v4 position NFT                       | StaticsDiamond   | ERC-721 operator approval                                         |

The inventory also discovers wallet-owned v4 positions that still carry the
older per-token approval and exposes each one for revocation.

## Tools boundary

`/app/tools` manages only authorities whose token and spender are derived from
the verified Statics deployment, the live basket catalog, and the pinned
Robinhood Uniswap v4 contracts.

Across bridge approvals and general portal-swap approvals can be created on
arbitrary origin networks for third-party venue contracts. They remain managed
by those venue flows and wallet/explorer tooling; the Robinhood Statics Tools
page does not claim to enumerate or revoke them.

“Revoke all” submits one explicit wallet transaction for every active authority
and stops on the first rejected or failed transaction. Already-confirmed
revocations remain effective.
