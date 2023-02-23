# PrePO contest details

- Total Prize Pool: $36,500 USDC
  - HM awards: $25,500 USDC
  - QA report awards: $3,000 USDC
  - Gas report awards: $1,500 USDC
  - Judge + presort awards: $6,000 USDC
  - Scout awards: $500 USDC
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-12-prepo-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts Dec 09, 2022 20:00 UTC
- Ends Dec 12, 2022 20:00 UTC

## C4udit / Publicly Known Issues

The C4audit output for the contest can be found [here](https://gist.github.com/Picodes/5221065a8bbe322678c9acdcdbcca4ff) within an hour of contest opening.

_Note for C4 wardens: Anything included in the C4udit output is considered a publicly known issue and is ineligible for awards._

# Overview

🚨 The contracts for this contest can be found here: https://github.com/prepo-io/prepo-monorepo/tree/feat/2022-12-prepo

This audit covers the entirety of PrePO's pre-IPO/ICO markets product.

![PrePO Core Architecture](https://user-images.githubusercontent.com/5270250/206607395-93accc08-11cb-420a-90a7-4cc588cac7b4.jpg)

# Scope

## Contracts (16)

| Contract                                                          | SLOC | Purpose                                                                                                                                                                                        | Libraries used                                                                                                              |
| ----------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| packages/prepo-shared-contracts/contracts/AccountListCaller.sol   | 16   | Inherited module for contracts that reads from an external `AccountList.sol`                                                                                                                   |
| packages/prepo-shared-contracts/contracts/AllowedMsgSenders.sol   | 21   | Inherited module for contracts that need to restrict `msg.sender` on certain functions (typically for preventing access to functions on a contract that are only meant to be called by a hook) |
| packages/prepo-shared-contracts/contracts/NFTScoreRequirement.sol | 57   | Inherited module for contracts that want to implement NFT-based account requirements.                                                                                                          | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)                                                                    |
| packages/prepo-shared-contracts/contracts/TokenSenderCaller.sol   | 24   | Inherited module for contracts that uses an external `TokenSender.sol`                                                                                                                         |                                                                                                                             |
| apps/smart-contracts/core/contracts/Collateral.sol                | 132  | Collateral for trading on PrePO Markets                                                                                                                                                        | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)                                                                    |
| apps/smart-contracts/core/contracts/DepositHook.sol               | 73   | Swappable hook for extending `Collateral`'s `deposit` function                                                                                                                                 | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)                                                                    |
| apps/smart-contracts/core/contracts/DepositRecord.sol             | 64   | Keeps track of global and user deposits for `Collateral`                                                                                                                                       | [`@openzeppelin/*`](https://openzeppelin.com/contracts/) [`@uniswap/v3-periphery`](https://github.com/Uniswap/v3-periphery) |
| apps/smart-contracts/core/contracts/DepositTradeHelper.sol        | 41   | Helper function for minting `Collateral` and swapping into PrePOMarket Uniswap pools                                                                                                           | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)                                                                    |
| apps/smart-contracts/core/contracts/LongShortToken.sol            | 12   | Token representing PrePOMarket positions.                                                                                                                                                      | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)                                                                    |
| apps/smart-contracts/core/contracts/ManagerWithdrawHook.sol       | 42   | Swappable hook for extending `Collateral`'s `managerWithdraw` function                                                                                                                         | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)                                                                    |
| apps/smart-contracts/core/contracts/MintHook.sol                  | 16   | Swappable hook for extending `PrePOMarket`'s `mint` function                                                                                                                                   | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)                                                                    |
| apps/smart-contracts/core/contracts/PrePOMarket.sol               | 161  | Issues new positions for a PrePO Market and allows users to redeem them back for `Collateral`                                                                                                  | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)                                                                    |
| apps/smart-contracts/core/contracts/PrePOMarketFactory.sol        | 50   | Contract factory for deploying new `PrePOMarket`'s                                                                                                                                             | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)                                                                    |
| apps/smart-contracts/core/contracts/RedeemHook.sol                | 28   | Swappable hook for extending `PrePOMarket`'s `redeem` function                                                                                                                                 | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)                                                                    |
| apps/smart-contracts/core/contracts/TokenSender.sol               | 79   | Sends tokens based on an input amount and price oracle, used for reimbursing platform fees in `PPO` token.                                                                                     | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)                                                                    |
| apps/smart-contracts/core/contracts/WithdrawHook.sol              | 155  | Swappable hook for extending `Collateral`'s `withdraw` function                                                                                                                                | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)                                                                    |

## Interfaces (for documentation) (18)

| Interface                                                                     | Purpose                                                                                                                                                       | Libraries used                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| packages/prepo-shared-contracts/contracts/interfaces/IAccountListCaller.sol   | All interfaces represent the contract their name implies unless otherwise specified (e.g. `IAccountListCaller` is the interface for `AccountListCaller.sol`). |
| packages/prepo-shared-contracts/contracts/interfaces/IAllowedMsgSenders.sol   |                                                                                                                                                               |                                                                    |
| packages/prepo-shared-contracts/contracts/interfaces/INFTScoreRequirement.sol |                                                                                                                                                               | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)           |
| packages/prepo-shared-contracts/contracts/interfaces/ITokenSender.sol         |                                                                                                                                                               |
| packages/prepo-shared-contracts/contracts/interfaces/ITokenSenderCaller.sol   |                                                                                                                                                               |
| packages/prepo-shared-contracts/contracts/interfaces/IUintValue.sol           | Interface for retrieving a price/value from an oracle                                                                                                         |                                                                    |
| apps/smart-contracts/core/contracts/interfaces/ICollateral.sol                |                                                                                                                                                               | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)           |
| apps/smart-contracts/core/contracts/interfaces/ICollateralHook.sol            | Base interface for all hooks that extend `Collateral` functions                                                                                               |
| apps/smart-contracts/core/contracts/interfaces/IDepositHook.sol               |                                                                                                                                                               |
| apps/smart-contracts/core/contracts/interfaces/IDepositRecord.sol             |                                                                                                                                                               |
| apps/smart-contracts/core/contracts/interfaces/IDepositRecordHook.sol         | Interface for a hook that reads/writes to a `DepositRecord`                                                                                                   |
| apps/smart-contracts/core/contracts/interfaces/IDepositTradeHelper.sol        |                                                                                                                                                               | [`@uniswap/v3-periphery`](https://github.com/Uniswap/v3-periphery) |
| apps/smart-contracts/core/contracts/interfaces/ILongShortToken.sol            |                                                                                                                                                               | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)           |
| apps/smart-contracts/core/contracts/interfaces/IManagerWithdrawHook.sol       |                                                                                                                                                               |
| apps/smart-contracts/core/contracts/interfaces/IMarketHook.sol                | Base interface for all hooks that extend `PrePOMarket` functions                                                                                              |                                                                    |
| apps/smart-contracts/core/contracts/interfaces/IPrePOMarket.sol               |                                                                                                                                                               |
| apps/smart-contracts/core/contracts/interfaces/IPrePOMarketFactory.sol        |                                                                                                                                                               |
| apps/smart-contracts/core/contracts/interfaces/IWithdrawHook.sol              |                                                                                                                                                               |

## Out of scope

### Contracts not in scope

| Contract                                                                             | Purpose                                                                                                           |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| packages/prepo-shared-contracts/contracts/interfaces/IAccountList.sol                | Interface used by many contracts for reading from a list of accounts stored within an external `AccountList.sol`. |
| packages/prepo-shared-contracts/contracts/SafeAccessControlEnumerable.sol            | Safe version of OZ's `AccessControlEnumerable`, requires acceptance of roles. Used throughout `Collateral` stack. |
| packages/prepo-shared-contracts/contracts/SafeAccessControlEnumerableUpgradeable.sol | Same as above, but for upgradeable contracts.                                                                     |
| packages/prepo-shared-contracts/contracts/SafeOwnable.sol                            | Safe version of OZ's `Ownable`, requires acceptance of ownership. Used throughout `PrePOMarket` stack.            |
| packages/prepo-shared-contracts/contracts/SafeOwnableUpgradeable.sol                 | Same as above, but for upgradeable contracts.                                                                     |
| packages/prepo-shared-contracts/contracts/WithdrawERC20.sol                          | Allows `owner` to withdraw any `ERC20` tokens residing within an inheriting contract.                             |

Additionally, contracts not listed in [Contracts (16)](#contracts-16) are out of scope for this contest.

### Known Issues

The following issues are ineligible and have already been highlighted in a previous audit https://code4rena.com/reports/2022-03-prepo

- [M-02 Market expiry behaviour differs in implementation and documentation](https://code4rena.com/reports/2022-03-prepo/#m-02-market-expiry-behaviour-differs-in-implementation-and-documentation)

## Scoping Details

```
- If you have a public code repo, please share it here:  https://github.com/prepo-io/prepo-monorepo
- How many contracts are in scope?:   16
- Total SLoC for these contracts?:  971 (not including interfaces/imports)
- How many external imports are there?: 16
- How many separate interfaces and struct definitions are there for the contracts within scope?:  18 interfaces, 2 structs
- Does most of your code generally use composition or inheritance?:   Composition
- How many external calls?:   1
- What is the overall line coverage percentage provided by your tests?:  100
- Is there a need to understand a separate part of the codebase / get context in order to audit this part of the protocol?:   false
- Please describe required context:
- Does it use an oracle?:  false
- Does the token conform to the ERC20 standard?:  Yes
- Are there any novel or unique curve logic or mathematical models?: N/A
- Does it use a timelock function?:  No
- Is it an NFT?: No
- Does it have an AMM?: No
- Is it a fork of a popular project?:   false
- Does it use rollups?:   false
- Is it multi-chain?:  false
- Does it use a side-chain?: false
```

# Tests

Run `yarn install` in the root `prepo-monorepo` directory to install all packages needed for testing

**Commands** and **Configuration** only apply to tests defined in the same project. The only two project directories contestants should concern themselves with are `apps/smart-contracts/core` and `packages/prepo-shared-contracts`.

### Commands

- Run tests for all contracts within a project: `yarn t`
- Run tests w/ code coverage: `yarn t:coverage`
- Run a specific test suite: `yarn hardhat test test/<test name>.test.ts`

### Configuration

- Edit `hardhat.config.ts` to setup connections to different networks
- To enable gas reporting, add `REPORT_GAS=true` to `.env`

**Note about Slither:** Slither isn't used by the development team and couldn't be made to work for the contest.
