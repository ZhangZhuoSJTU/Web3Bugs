# Backd contest details

- $95,000 USDC main award pot
- $5,000 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-04-Backd-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts April 21, 2022 00:00 UTC
- Ends April 27, 2022 23:59 UTC

In this document, we give a high-level overview of Backd's code for participants of the Code4arena contest.
We only focus on the contracts within the scope of the contest.

## High-level overview

![Backd contracts overview](https://user-images.githubusercontent.com/1436271/164278494-87fdd3ca-4213-4be8-b125-d26ae2ab993e.png)

The code is splitted into three main parts: core functionality, pool-related code, and topup action related code. We show an overview of the structure in the diagram above.


### Pool

A pool deployment is composed of five different contracts that interact together: 

* `LiquidityPool` -- a single-asset pool that allows users to deposit and withdraw funds
* `LP token` -- the LP token associated with a given pool, and used as a unit of accounting for it
* `Vault` -- the storage for the underlying assets received by the pool. It typicall delegates most of the funds to the strategy it is associated with
* `Strategy` -- the contract delegating funds to other protocols to generate yield for the pool
* `StakerVault` -- the contract in which users can stake their LP tokens to be able to use them for actions

A user can deposit the `LiquidityPool` underlying asset and receive its LP token in exchange. On deposit, the pool delegates the liquidity to its vault once it has too much idle funds. The vault in turn delegates the liquidity to the strategy that will use the funds to generate yield.
On withdrawal, the opposit process occurs. When a user withdraws from a pool, if the pool does not have sufficient idle funds, it will request funds from the vault that will request from the strategy.

The staker vault is used to stake LP tokens from the pool. When a user wants to use the topup action, they are required to stake their LP tokens in the pool's staker vault in order for their token to be usable in that context.


### Topup action

The topup action is an [action](https://docs.backd.fund/protocol-architecture/actions) that allows user to automatically topup their collateral on a lending platform to avoid being liquidated. 
Once a user stakes an amount of LP tokens equivalent to the amount of funds they want to use to topup, the user can register his topup position. A topup position consists mainly of the following:

* protocol -- Aave and Compound are currently supported
* borrowing position -- the account that is currently borrowing funds on the lending platform
* minimum collateral factor -- the collateral factor (health factor) under which the collateral in Backd will be used to add collateral to the lending platform

When the minimum collateral factor is reached, off-chain bots that we name [keepers](https://docs.backd.fund/protocol-architecture/backd-keepers) will call the topup action to execute the collateral topup.
The protocol-specific logic is handled in per-protocol topup handlers that the topup action delegate-calls when executing the topup.
When a top-up is executed, a percentage of the topped up amount is taken as fee. This fee distribution is handled by the fee handler and is currently split between the keeper and the pool of which the LP token was used.

To repay the keeper's gas fees, users registering a position have to put an estimate of what a top-up will cost in the gas bank.
When a top-up is executed, the gas bank will pay the keeper the gas cost in ETH directly.

Finally, the keeper helper contains logic to simplify tracking of positions that can be topped-up.


### Core

The code in core functionality handles the core authorization logic across all the protocol and also acts as a contract registry.

The contract registry is the address provider and keeps track of the pools, their LP tokens and staker vault, as well as the existing actions (only topup action for now).
The controller is mostly built on top of the address provider and is mostly used for changes that require more than simply updating a contract that is pointed to.

The role manager contains the authorization logic. It uses role-based authorization where the role to access most of the admin functionality of the system is "governance". Other roles are typically classes of contracts such as "zaps" or "pools".
Almost all the contracts in the protocol delegate to the role manager for their authorization management through the `Authorization` base contract.


## Files in scope


Filename | Lines of code
---------|---------------
contracts/actions/topup/TopUpAction.sol | 595
contracts/strategies/BkdTriHopCvx.sol | 221
contracts/vault/Vault.sol | 506
contracts/pool/LiquidityPool.sol | 486
contracts/strategies/BkdEthCvx.sol | 104
contracts/StakerVault.sol | 262
contracts/AddressProvider.sol | 245
contracts/CvxCrvRewardsLocker.sol | 178
contracts/pool/PoolFactory.sol | 159
contracts/actions/topup/TopUpActionFeeHandler.sol | 154
contracts/access/RoleManager.sol | 136
contracts/actions/topup/handlers/CompoundHandler.sol | 118
contracts/actions/topup/TopUpKeeperHelper.sol | 105
contracts/utils/Preparable.sol | 90
contracts/Controller.sol | 81
contracts/GasBank.sol | 62
contracts/vault/VaultReserve.sol | 62
contracts/actions/topup/handlers/CTokenRegistry.sol | 54
contracts/oracles/ChainlinkUsdWrapper.sol | 54
contracts/LpToken.sol | 53
contracts/actions/topup/handlers/AaveHandler.sol | 47
contracts/oracles/ChainlinkOracleProvider.sol | 39
contracts/vault/Erc20Vault.sol | 38
contracts/vault/EthVault.sol | 35
libraries/AddressProviderHelpers.sol | 35
contracts/pool/Erc20Pool.sol | 34
contracts/pool/EthPool.sol | 34
contracts/access/AuthorizationBase.sol | 33
contracts/utils/Pausable.sol | 22
contracts/utils/CvxMintAmount.sol | 19
libraries/AddressProviderMeta.sol | 19
libraries/ScaledMath.sol | 17
contracts/vault/VaultStorage.sol | 15
contracts/oracles/OracleProviderExtensions.sol | 13
contracts/access/Authorization.sol | 11
contracts/actions/topup/handlers/BaseHandler.sol | 5
contracts/strategies/ConvexStrategyBase.sol | 276
contracts/strategies/StrategySwapper.sol | 213
