# yAxis contest details
- $28,500 USDC main award pot
- $1,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2021-11-yaxis-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts November 16, 2021 00:00 UTC
- Ends November 18, 2021 23:59 UTC

## Introduction

The scope of this program should be on contracts in the `v3/alchemix` directory. The contracts are adopted from Alchemix protocol, which provides highly flexible instant loans that repay themselves over time.

The main changes are

1. Add borrow fees when users mint alUSD. The borrow fees will be sent to a reward address
2. Add yAxis vault adaptor

## Contracts

### Alchemist (line 287-300 and 604-645)

Alchemist.sol exposes the main functions for users to interact, like deposit, withdraw, liquidate, repay, mint. The differences between the original Alchemix contract is adding a `setBorrowFee` function and charging borrow fee when users `mint`.

#### External calls
- AlToken

### YaxisVaultAdapter (LOC: 99)

It helps Alchemist manage users' fund to generate yeild through yAxis vault. It should be able to handle deposit and withdraw fund from yAxis vault correctly. It should make sure the conversation between share and token correctly

#### External calls
- Vault

#### Libraries used
- SafeERC20
- SafeMath
