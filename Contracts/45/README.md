# Union Finance contest details

- $57,000 worth of ETH main award pot
- $3,000 worth of ETH gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-10-union-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts Oct 14 00:00 UTC
- Ends Oct 20 23:59 UTC

# Links

- [union.finance](https://union.finance/)
- [twitter](https://twitter.com/unionprotocol)
- [blog](https://medium.com/union-finance)
- [docs](https://unionfinance.gitbook.io/docs/)
- [discord](https://discord.gg/cZagzJ3p8G)
- [github](https://github.com/unioncredit)

# Documentation

- [Gitbook](https://unionfinance.gitbook.io/docs/)
- [Gitbook - contracts overview](https://unionfinance.gitbook.io/docs/overview/core)
- [Gitbook - governance overview](https://unionfinance.gitbook.io/docs/overview/governance)

A good place to start are the `UserManager` and `uToken` contracts.

| Line count | Contract             | Description                                                                                                                              |
| ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 339        | Comptroller.sol      | Distributes rewards                                                                                                                      |
| 92         | UnionToken.sol       | Mint and distribute UnionTokens.                                                                                                         |
| 0          | CreditLimitModel.sol | Calculate the user's credit line based on the trust he receives from the vouchees.                                                       |
| 175        | AaveAdapter.sol      |                                                                                                                                          |
| 161        | CompoundAdapter.sol  |                                                                                                                                          |
| 479        | AssetManager.sol     | Manage the token balances staked by the users and deposited by admins, and invest tokens to the integrated underlying lending protocols. |
| 100        | PureTokenAdapter.sol |                                                                                                                                          |
| 837        | UserManager.sol      | Manages the Union members credit lines, and their vouchees and borrowers info.                                                           |
| 150        | UnionGovernor.sol    |                                                                                                                                          |
| 18         | UErc20.sol           |                                                                                                                                          |
| 102        | MarketRegistry.sol   | Registering and managing all the lending markets.                                                                                        |
| 767        | UToken.sol           | Union members can borrow and repay thru this component.                                                                                  |
| 51         | TreasuryVester.sol   |                                                                                                                                          |
| 118        | Treasury.sol         |                                                                                                                                          |

# Networks

Union is an upgradeable system. Each deployed contract is actually a "Proxy" that points to an "Implementation" contract. All addresses can be found in the folder `deployments/${network}`.

## Kovan

| Contract         | Address (proxy)                                                                                                             | Upgradeable |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------- |
| UserManager      | [0x77aABF576fe07f06bdde95Ba25625d3a91A6190F](https://kovan.etherscan.io/address/0x77aABF576fe07f06bdde95Ba25625d3a91A6190F) | ✅          |
| MarketRegistry   | [0xB0f8Be21E30ae291e002aD8A28A85e90266Ad099](https://kovan.etherscan.io/address/0xB0f8Be21E30ae291e002aD8A28A85e90266Ad099) | ✅          |
| Comptroller      | [0x4cAc792Cdb49a9036E4f1dE8F60e86f485D0EB98](https://kovan.etherscan.io/address/0x4cAc792Cdb49a9036E4f1dE8F60e86f485D0EB98) | ✅          |
| UToken (uDAI)    | [0xd9bAe3CF2E16E72A5a3896d11e46449E65Aa6F52](https://kovan.etherscan.io/address/0xd9bAe3CF2E16E72A5a3896d11e46449E65Aa6F52) | ✅          |
| AssetManager     | [0x205365B5474D7488fcd862010B1FcA5Bd8c485C9](https://kovan.etherscan.io/address/0x205365B5474D7488fcd862010B1FcA5Bd8c485C9) | ✅          |
| CompoundAdapter  | [0xf90a43Ed2e76f0635c0f2208D17BCf0C380D270C](https://kovan.etherscan.io/address/0xf90a43Ed2e76f0635c0f2208D17BCf0C380D270C) | ✅          |
| AaveAdapter      | [0x205365B5474D7488fcd862010B1FcA5Bd8c485C9](https://kovan.etherscan.io/address/0x205365B5474D7488fcd862010B1FcA5Bd8c485C9) | ✅          |
| PureTokenAdapter | [0x93AC44Eff25e0F055CA2B1d4bcCEF453A8541F96](https://kovan.etherscan.io/address/0x93AC44Eff25e0F055CA2B1d4bcCEF453A8541F96) | ✅          |
| UnionToken       | [0x598C0657385A1a631dD71818485bD704CFa552aE](https://kovan.etherscan.io/address/0x598C0657385A1a631dD71818485bD704CFa552aE) | ❌          |
| Governor         | [0xed1411eaCDaE26ACeAf0240cf4B4077dbB75d06a](https://kovan.etherscan.io/address/0xed1411eaCDaE26ACeAf0240cf4B4077dbB75d06a) | ❌          |
| Timelock         | [0x5aAD7F7239c28Aa38c6BA6b62B3267D3a6Bb7F7a](https://kovan.etherscan.io/address/0x5aAD7F7239c28Aa38c6BA6b62B3267D3a6Bb7F7a) | ❌          |
| Treasury         | [0x14bF0cb2dEb280e8FE68242F06206F970c2ef425](https://kovan.etherscan.io/address/0x14bF0cb2dEb280e8FE68242F06206F970c2ef425) | ❌          |
| Treasury Vester  | [0x15dCc98027dC9a3E655A37bD36ED7F7483aBBEc8](https://kovan.etherscan.io/address/0x15dCc98027dC9a3E655A37bD36ED7F7483aBBEc8) | ❌          |
| Kovan DAI        | [0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa](https://kovan.etherscan.io/address/0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa) | ❌          |
| Kovan cDAI       | [0xf0d0eb522cfa50b716b3b1604c4f0fa6f04376ad](https://kovan.etherscan.io/address/0xf0d0eb522cfa50b716b3b1604c4f0fa6f04376ad) | ❌          |

# Setup

Requirements:

- Node @12.x
- Python @3.x (for running Slither)

Clone the repo and then install dependencies:

```
$ yarn install
```

# Testing

To run the entire test suite:

```
$ yarn test
```

# Coverage

To run tests with coverage:

```
$ yarn coverage
```
