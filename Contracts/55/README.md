# Maple Finance contest details
- $67,500 USDC main award pot
- $7,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2021-12-maple-finance-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts December 2, 2021 00:00 UTC
- Ends December 8, 2021 23:59 UTC

# Audit Scope

This scope of this audit includes the following repos, all with corresponding release tags:

- [maple-labs/debt-locker](https://github.com/maple-labs/debt-locker/releases/tag/v2.0.0-beta.1)
- [maple-labs/erc20-helper](https://github.com/maple-labs/erc20-helper/releases/tag/v1.0.0-beta.1)
- [maple-labs/liquidations](https://github.com/maple-labs/liquidations/releases/tag/v1.0.0-beta.1)
- [maple-labs/loan](https://github.com/maple-labs/loan/releases/tag/v2.0.0-beta.1)
- [maple-labs/maple-proxy-factory](https://github.com/maple-labs/maple-proxy-factory/releases/tag/v1.0.0-beta.1)
- [maple-labs/proxy-factory](https://github.com/maple-labs/proxy-factory/releases/tag/v1.0.0-beta.1)

These contracts include inheritance, so the scope of the audit will be expressed as the contracts at the lowest end of the hierarchy, as these are what will be deployed to mainnet. Since there are no external libraries used, all of the code that these flattened contracts use is in scope for audit.

## `maple-labs/debt-locker`
- DebtLocker.sol
- DebtLockerFactory.sol
- DebtLockerInitializer.sol

## `maple-labs/liquidations`
- Liquidator.sol
- SushiswapStrategy.sol
- UniswapV2Strategy.sol

## `maple-labs/loan`
- MapleLoan.sol
- MapleLoanFactory.sol
- MapleLoanInitializer.sol
- Refinancer.sol

## Focus Areas
- **Proxy patterns**: Ensure that there are no vulnerabilities, exploit paths, or unexpected behaviors in any of the proxy patterns used. 
- **Liquidation module**: Ensure that there are no attack vectors to drain funds from the Liquidator in an unexpected way.
- **Loan accounting**: Ensure that there is no way to manipulate Loan accounting, mainly focusing on the `_getUnaccountedAmount` functionality.
- **Locked funds**: Ensure that there is no way for funds to get locked in the DebtLocker, Liquidator or Loan smart contracts.
- **Stoten funds**: Ensure that any funds that are held custody by contracts cannot be withdrawn maliciously.
- **Refinancing**: Ensure that the Refinancer contract cannot be used maliciously to exploit the Loan.

It is recommended to clone our integration testing repo [contract-test-suite](https://github.com/maple-labs/contract-test-suite) locally in order to provide clearer context with how these contracts interact with the rest of the protocol.

In all repos, all dependencies can be found in the `./modules` directory. All repo READMEs include instructions on how to get the environment up and running for testing. All repos have their own unit testing suite, including verbose unit testing fuzz testing, and symbolic execution.

All technical documentation related to this release will be located in the `maple-labs/loan` [wiki](https://github.com/maple-labs/loan/wiki). We HIGHLY recommend reviewing this wiki before beginning the audit.

There is also a [wiki](https://github.com/maple-labs/maple-core/wiki) for our V1 protocol if any further context is needed on how deployed V1 contracts work (Pools, StakeLocker, etc.)

## Observations

In the wiki, there's a page called [List of Assumptions](https://github.com/maple-labs/loan/wiki/List-of-Assumptions) which outlines some basic conditions/assumptions that we assume that will always hold true. Therefore any issue that does not abide by these assumptions will likely be considered invalid.
