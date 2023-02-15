# Sturdy contest details
- $28,500 USDC main award pot
- $1,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-05-sturdy-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts May 13, 2022 00:00 UTC
- Ends May 15, 2022 23:59 UTC

## Protocol overview

Sturdy is a protocol for interest-free borrowing and high yield lending.

[Lenders](#glossary) deposit stablecoins that they want to earn yield on while [borrowers](#glossary) provide collateral and take out loans at no interest (interest rates will kick in above certain utilization rates, but this functionality is out of scope). Sturdy accomplishes this by staking collateral provided by borrowers in third party protocols like Yearn, Lido, and Convex. The yield from collateral staking is periodically harvested, swapped to stablecoins, and distributed to stablecoin lenders.

Sturdy forked Aave V2 contracts for its underlying accounting and lending pool mechanics. In order to convert non-interest bearing tokens ('[external assets](#glossary)', e.g. ETH) to their interest bearing equivalent ('[internal assets](#glossary)', e.g. stETH), Sturdy uses modules called 'vaults.' When users deposit external assets to a vault, the vault immediately stakes it, converting it to an internal asset, and deposits it to the lending pool. When users want to withdraw their collateral, the vault withdraws the internal asset from the lending pool, unstakes it, and returns it to the user. The user can also deposit or withdraw internal assets directly from the lending pool by interacting directly with the smart contracts. 

[`PoolAdmin`](#glossary) can harvest the yield by calling a function that distributes excess staked collateral to lenders after swapping it to stablecoins. This can take on a different form based on the specific collateral asset and staking strategy as described for each vault contract below. 

The full repository (with tests) can be found [here](https://github.com/sturdyfi/code4rena-may-2022).

## Contest scope
The focus of the contest is to find any methods of stealing funds belonging to users. We would highlight **ConvexCurveLPVault.sol** as a contract that deserves particular attention because it has not been audited and contains lots of novel logic. All five contracts listed below are in scope.

  

## Smart contracts

**GeneralVault.sol** (83 sLOC)
Template that all other vaults inherit. It provides a skeleton for the basic functions of every vault contract including:
- `depositCollateral`: called by the borrower. Stakes the collateral (via `_depositToYieldPool`) and then deposits to [**LendingPool.sol**](#glossary)
- `withdrawCollateral`: called by the borrower. Computes amount of collateral to withdraw (via `_getWithdrawalAmount`), withdraws this amount from **LendingPool.sol**, then unstakes the token and transfers it to the borrower (via `_withdrawFromYieldPool`)
- `processYield`: called by the `PoolAdmin`. Computes the amount of yield (via `getYield`, withdraws this yield from the lending pool, and transfers it to **YieldManager.sol**

**LidoVault.sol** (68 sLOC)
Vault contract that enables users to deposit ETH as collateral and stakes it in Lido. This vault is unique in that (pre-merge) borrowers cannot withdraw the base token 1:1. They can either withdraw their collateral as stETH or withdraw via the Curve pool, with an exchange rate based on current market conditions.

Yield accrues via stETH rebasing. To compute yield, the vault takes the difference between the amount of ETH deposited and the amount of stETH in the contract. The difference is swapped to ETH and transferred to **YieldManager.sol**.

**ConvexCurveLPVault.sol** (81 sLOC)
Vault contract that enables users to deposit Curve LP tokens as collateral and stakes them in Convex. This vault is unique in that Convex does not have a "receipt" token that it provides after staking, meaning there is no natural internal asset. Instead, this contracts mints an ERC20 token called `_internalToken` via **SturdyInternalAsset.sol**. `_internalToken` is the token that gets deposited to **LendingPool.sol**, and is burned upon collateral withdrawal.

Yield accrues via CRV and CVX rewards from Convex staking. When yield is harvested, the vault transfers all CRV and CVX rewards to **YieldManager.sol**.

**CollateralAdapter.sol** (26 sLOC)
Returns the address of an internal asset from the address of an external asset. This is used in **LendingPool.sol**'s liquidation process.


**YieldManager.sol** (108 sLOC)
Receives tokens from vaults, swaps them to stables, and distributes them to lenders. Currently, all tokens received are swapped to USDC via Uniswap. Then USDC is swapped to other stablecoins based on their proportion of total deposits via Curve. The goal of this design is to save gas by minimizing swaps without incurring significant slippage.

For example, if DAI makes up 20% of all stablecoin deposits, then 20% of the USDC is swapped to Dai. The yield is transferred to **LendingPool.sol** and the balance of each lender is automatically increased.

## Glossary
| Name     | Description |
| ----------- | ----------- |
| Lender      | Users who deposit stablecoins to earn yield       |
| Borrower   | Users who provide collateral and take out loans by borrowing stablecoins that have been deposited by lenders        |
| PoolAdmin   | A permissioned role set by the protocol        |
| LendingPool.sol   | An out of scope contract that interacts with several in scope contracts. LendingPool.sol exposes the user-oriented actions for depositing, withdrawing, borrowing, and repaying stablecoins, as well as the logic for liquidations. Vaults interact with LendingPool.sol when allowing the user to deposit or withdraw collateral.        |
| External asset   | Non-interest bearing tokens like Curve LP tokens or ETH. These are the tokens that users typically interact with directly.        |
| Internal asset   | Interest bearing tokens like stETH that are held in LendingPool.sol.        |
