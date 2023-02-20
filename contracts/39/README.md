# Swivel contest details
- $67,500 worth of ETH main award pot
- $7,500 worth of ETH gas optimization award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-09-swivel-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts September 30, 2021 00:00 UTC
- Ends October 6, 2021 23:59 UTC

# Introduction

Swivel is a yield tokenization protocol that allows LP's, stakers and lenders to separate their yield into two components, zcTokens (which represent the 1-1 claim to deposited tokens upon maturity), and nTokens (which represent the claim to any yield generated). In addition to this base functionality, Swivel provides the infrastructure to facilitate the exchange of these tokens through an orderbook. This allows users to lend with low or no slippage, and liquidity providers to avoid the alpha decay inherent to LPing in derivative markets on an AMM.

Regarding our orderbook infrastructure, the base orderbook functionality is most similar to the original 0x-v3. Users EIP-712 sign an order object which contains information regarding asset, maturity, maker, price, amount, and whether the user is initiating a new position vs exiting/selling a currently held zcToken or nToken position.

A testnet is currently live at https://swivel.exchange .

General Project Docs:https://docs.swivel.finance

Contract Docs: https://docs.swivel.finance/developers/contract 

Recent Video Overview (ETHOnline): https://www.youtube.com/watch?v=hI0Uwd4Xayg .

### **Order Path:**
A taker initiates their own position using `initiate` or `exit` on Swivel.sol, in the process filling another user's order. Swivel.sol handles fund custody and deposits/withdrawals from underlying protocols (compound). Params are routed to Marketplace.sol and according to the `underlying` and `maturity` of an order, a market is identified (asset-maturity combination), and zcTokens and nTokens are minted/burnt/exchanged within that market according to the params.

Order fill amounts and cancellations are tracked on chain based on a keccak of the order itself.

### **nToken and zcToken functionality:**
When a user initiates a new fixed-yield position on our orderbook, or manually calls `splitUnderlying`, an underlying token is split into zcTokens and nTokens. (the fixed-yield comes from immediately selling nTokens).

A zcToken (standard erc-20 + erc-2612) can be redeemed 1-1 for underlying upon maturity. After maturity, if a user has not redeemed their zcTokens, they begin accruing interest from the deposit in compound. 

An nToken (non-standard contract balance) is a balance within a users `vault`(vault.notional) within VaultTracker.sol. nTokens (notional balance) represent a deposit in an underlying protocol (compound), and accrue the interest from this deposit until maturity. This interest can be redeemed at any time.


# Smart Contracts 
| **Contracts**    | **Link** | **LOC** | **LIBS** | **External** |
|--------------|------|------|------|------|
| Swivel       |[Link](https://github.com/Swivel-Finance/gost/blob/v2/test/swivel/Swivel.sol)| 486 | [Abstracts.sol](https://github.com/Swivel-Finance/gost/blob/v2/test/swivel/Abstracts.sol), [Hash.sol](https://github.com/Swivel-Finance/gost/blob/v2/test/swivel/Hash.sol), [Sig.sol](https://github.com/Swivel-Finance/gost/blob/v2/test/swivel/Sig.sol) | [CToken.sol](https://github.com/compound-finance/compound-protocol/blob/master/contracts/CToken.sol) |
| Marketplace  |[Link](https://github.com/Swivel-Finance/gost/blob/v2/test/marketplace/MarketPlace.sol)| 259 | [Abstracts.sol](https://github.com/Swivel-Finance/gost/blob/v2/test/marketplace/Abstracts.sol) |
| VaultTracker |[Link](https://github.com/Swivel-Finance/gost/blob/v2/test/vaulttracker/VaultTracker.sol)| 251 | [Abstracts.sol](https://github.com/Swivel-Finance/gost/blob/v2/test/vaulttracker/Abstracts.sol) | [CToken.sol](https://github.com/compound-finance/compound-protocol/blob/master/contracts/CToken.sol) |

## **Swivel:**
Swivel.sol handles all fund custody, and most all user interaction methods are on Swivel.sol (`initiate`,`exit`,`splitUnderying`,`combineTokens`, `redeemZcTokens`, `redeemVaultInterest`). We categorize all order interactions as either `payingPremium` or `receivingPremium` depending on the params (`vault` & `exit`) of an order filled, and whether a user calls `initiate` or `exit`. 

For example, if `vault` = true, the maker of an order is interacting with their vault, and if `exit` = true, they are selling notional (nTokens) and would be `receivingPremium`. Alternatively, if `vault` = false, and `exit` = false, the maker is initiating a fixed yield, and thus also splitting underlying and selling nTokens, `receivingPremium`. 

A warden, @ItsmeSTYJ was kind enough to organize a matrix which might help understand the potential interactions: [Link](https://cdn.discordapp.com/attachments/893151471388999690/893367485540212756/unknown.png)


Outside of this sorting, the basic order interaction logic is:
1. Check Signatures, Cancellations, Fill availability for order validity
2. Calculate either principalFilled or premiumFilled depending on whether the order is paying/receivingPremium
3. Calculate fee
4. Deposit/Withdraw from compound and/or exchange/mint/burn zcTokens and nTokens through marketplace.sol
5. Transfer fees

Other methods (`splitUnderying`,`combineTokens`, `redeemZcTokens`, `redeemVaultInterest`) largely just handle fund custody from underlying protocols, and shoot burn/mint commands to marketplace.sol.

## **Marketplace:**
Marketplace.sol acts as the central hub for tracking all markets (defined as an asset-matury pair). Markets are stored in a mapping and admins are the only ones that can create markets.

Any orderbook interactions that require zcToken or nToken transfers are handled through marketplace burn/mints in order to avoid requiring approvals.

If a user wants to transfer nTokens are without using our orderbook, they do so directly through the marketplace.sol contract.

## **VaultTracker:**
A user's vault has three properties, `notional` (nToken balance), `redeemable` (underlying accrued to redeem), and `exchangeRate` (compound exchangeRate of last vault interaction).

When a user takes on a floating position and purchases nTokens (vault initiate), they increase the notional balance of their vault (`vault.notional`). Opposingly, if they sell nTokens, this balance decreases.

Every time a user either increases/decreases their nToken balance (`vault.notional`), the marginal interest since the user's last vault interaction is calculated + added to `vault.redeemable`, and a new `vault.exchangeRate` is set.


# Areas of Concern:
There are a few primary targets for concern:
1. Ensuring no vulnerabilities in order validity and the use of an order's hash to track cancel status and fill amount.
2. Ensuring the accurate calculation of deposit interest. This includes VaultTracker.sol + the calculation of marginal interest between vault interactions pre-maturity, and Marketplace.sol + the calculation of zcToken interest post-maturity.
3. Ensuring maturity is handled properly.

One additional small area of concern that isn't necessarily defined in the scope above but may be rewarded could be in the ERC-2612 chain imported as zcToken.sol in Marketplace.sol
