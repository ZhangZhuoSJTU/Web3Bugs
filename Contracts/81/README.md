# Notional contest details

- $71,250 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-01-notional-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts January 27, 2022 00:00 UTC
- Ends February 2, 2022 23:59 UTC

# Audit Scope

| Module    | File                | Code | Comments | Total Lines | Complexity / Line |
| :-------- | :------------------ | ---: | -------: | ----------: | ----------------: |
| Contracts | ActionGuards.sol    |   13 |        5 |          24 |               7.7 |
| Contracts | TreasuryAction.sol  |  128 |       42 |         200 |              11.7 |
| Contracts | TreasuryManager.sol |  171 |       20 |         226 |               2.9 |
| Contracts | sNOTE.sol           |  234 |       91 |         390 |               4.3 |
| Global    | Constants.sol       |    8 |        7 |          19 |               0.0 |
| Global    | LibStorage.sol      |   47 |       17 |          71 |               0.0 |
| Global    | StorageLayoutV1.sol |   19 |       28 |          54 |               0.0 |
| Global    | StorageLayoutV2.sol |    8 |        4 |          16 |               0.0 |
| Global    | Types.sol           |   23 |       23 |          50 |               0.0 |
| Math      | Bitmap.sol          |   69 |       13 |          91 |              23.2 |
| Math      | FloatingPoint56.sol |   14 |       14 |          34 |               7.1 |
| Math      | SafeInt256.sol      |   46 |       15 |          83 |              34.8 |
| Stubs     | BalanceHandler.sol  |   57 |       12 |          81 |               5.3 |
| Stubs     | TokenHandler.sol    |   63 |       19 |          95 |              25.4 |
| Utils     | BoringOwnable.sol   |   33 |       16 |          58 |              18.2 |
| Utils     | EIP1271Wallet.sol   |  158 |       21 |         216 |               5.7 |
| Utils     | EmptyProxy.sol      |   11 |        3 |          18 |               9.1 |
| Utils     | nProxy.sol          |   13 |        2 |          19 |               0.0 |

# Staked NOTE Specification

The goal of Staked NOTE is to align NOTE token holders with the long term success of the Notional protocol. NOTE holders can stake their NOTE to earn additional yield while signalling that they are willing to provide valuable liquidity over the long term. It's design is inspired by the Aave Safety Module (stkAAVE). Over time we hope to achieve:

- Reduced NOTE circulating supply
- On Chain liquidity for trading NOTE
- NOTE token holders can share in the success of the protocol

There are three primary components of the Staked NOTE design:

- [Staked NOTE (sNOTE)](#staked-note): NOTE tokens used to provide liquidity for NOTE/ETH trading (in an 80/20 Balancer Pool) as well as acting as a backstop for Notional in the event of a [collateral shortfall event](#collateral-shortfall-event).
- [Treasury Action](#treasury-action): A set of authenticated actions is deployed behind the Notional proxy to transfer profits to the treasury manager contract and manage Notional reserves.
- [Treasury Manager](#treasury-manager): A treasury manager is appointed to withdraw profits via the Treasury Action contract (deployed behind the primary Notional Proxy) to manage trading profits into sNOTE holdings.

## Staked NOTE

### Minting sNOTE

Staked NOTE (sNOTE) is minted to NOTE token holders in return for either NOTE or underlying sNOTE Balancer Pool Tokens (BPT). If only NOTE is supplied then some will be sold as ETH to mint the corresponding amount of BPT. All NOTE staked in sNOTE is used to provide liquidity in an 80/20 NOTE/ETH Balancer Pool. The 80/20 ratio reduces the impact of impermanent loss to sNOTE holders while they earn trading fees on NOTE/ETH.

### Redeeming sNOTE

sNOTE is also used as a backstop during a [collateral shortfall event](#collateral-shortfall-event). When this is triggered via governance, 30% of underlying sNOTE BPT will be transferred to the [Treasury Manager](#treasury-manager) to be sold to recover the collateral shortfall. Therefore, to prevent sNOTE holders from front running a collateral shortfall event the sNOTE contract will enforce a cool down period before sNOTE redemptions can occur. sNOTE holders can only redeem sNOTE to underlying BPT during their redemption window.

### Collateral Shortfall Event

In the event of a hack or account insolvencies, the Notional protocol may not have sufficient collateral to pay lenders their principal plus interest. In this event, NOTE governors will declare a collateral shortfall event and withdraw up to 50% of the sNOTE BPT tokens into NOTE and ETH. The NOTE portion will be sold or auctioned in order to generate collateral to repay lenders.

### sNOTE Yield Sources

sNOTE will earn yield from:

- Notional treasury management will periodically trade Notional protocol profits into ETH in order to purchase NOTE and increase the overall BPT share that sNOTE holders have a claim on.
- Governance may decide to incentivize sNOTE with additional NOTE tokens for some initial bootstrapping period.
- Trading fees on the Balancer Pool. Since we anticipate that the sNOTE BPT pool will the the deepest liquidity for NOTE on chain, most NOTE DEX trading will likely come through this pool. sNOTE holders will be able to set the trading fee on the pool.

### sNOTE Voting Power

sNOTE holders will also be able to vote in Notional governance just like NOTE holders. The voting power of an sNOTE token is based on the amount of underlying NOTE the Balancer pool tokens have a claim on, using Balancer's provided price oracles.

Because the price oracle will be a lagged weighted average, the sNOTE voting power will likely be slightly higher or lower than the spot claim on Balancer pool tokens.

## Treasury Action

Notional V2 uses a number of contracts deployed behind an upgradeable [Router](https://github.com/notional-finance/contracts-v2/blob/master/contracts/external/Router.sol) to handle all potential actions. The `TreasuryAction.sol` contract will be deployed behind the Router and manage both reserves and accumulated COMP incentives. All calls to the Treasury Action contract will be authenticated to the contract owner or by the `TreasuryManager.sol` contract.

Notional will accumulate reserves in each currency every time lending and borrowing occurs. These reserves can be used as a cushion against a collateral shortfall event. If there is insufficient cash for a lender to withdraw, they will withdraw into the reserve buffer. Due to the nature of how cash balances are pooled, it's not possible to know during a withdraw if it is truly from the "reserve". The purpose of `setReserveCashBalance` is so that governance can reset the balance of the cash reserve if it has been withdrawn from.

If reserves surpass a minimum reserve balance set by governance, the treasury manager can withdraw reserves and use them to accumulate profits to sNOTE holders.

Notional V2 is also one of the largest lenders on Compound Finance and has accrued significant COMP incentives as a result. Treasury Action allows the Treasury Manager to claim COMP incentives.

## Treasury Manager

In order to minimize front running and MEV, we employ a Treasury Manager contract to hold profits generated by Notional V2 and trade via 0x limit orders. An appointed Treasury Manager EOA will sign 0x orders that will trade profits to WETH. Periodically, the Treasury Manager will invest WETH into the sNOTE's 80/20 Balancer Pool (buying NOTE as a result) and donate the BPT tokens to the sNOTE contract. All sNOTE holders will earn a larger claim on BPT (and thus NOTE and ETH as a result).

The treasury manager will be restricted by governance to trading on 0x and the 80/20 Balancer pool to a certain slippage tolerance, set by governance.
