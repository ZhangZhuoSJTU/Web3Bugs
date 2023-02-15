# Mimo DeFi contest details
- $47,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-04-mimo-defi-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts April 28, 2022 00:00 UTC
- Ends May 2, 2022 23:59 UTC

---

## Introduction

The [Mimo protocol](https://mimo.capital/) is a decentralized stablecoin issuance protocol on the Ethereum, Polygon and Fantom blockchain. Parallel stablecoins are decentralized, non-custodial, collateral-backed, and fully redeemable synthetic assets pegged to a fiat currency.

At launch, the Mimo Protocol offers a single ERC20 stablecoin called PAR which is pegged to the Euro.

The protocol was launched in December 2020 and has been audited by Quantstamp and CertiK (see [core/audits](https://github.com/code-423n4/2022-04-mimo/tree/main/core/audits)).

## Contest Scope

The goal of this contest is to audit a set of contracts that are built on top of the already deployed and live core protocol. The focus is on finding any logic errors or exploits that benefit an attacker at the expense of protocol users. Wardens should assume that governance variables are set sensibly (unless they can find a way to change the value of a governance variable without using social engineering).

The already live core protocol is out of scope for this contest. See [Files in Scope](#files-in-scope) for an exact list of files that are in scope.

### Inception Vaults

Inception Vaults enable using any ERC20 as collateral by adding a lending & borrowing layer on top of the Mimo protocol vaults. This enables owners to generate yield with their minted PAR and users to leverage their ERC20 to borrow PAR.

See the documentation [here](https://github.com/code-423n4/2022-04-mimo/tree/main/core/docs/inception-vault/README.md).

Contracts can be found in the [core/contracts/inception](https://github.com/code-423n4/2022-04-mimo/tree/main/core/contracts/inception) folder.

To only run the tests for Inception Vaults please run `yarn hardhat test test/inceptionVault/*.test.ts` in the `core/` folder.

### Liquidity Mining V2

The next version of reward contracts for the users of the protocol. In the first iteration of liquidity mining contracts, users earned MIMO tokens on their debt and staked LP and PAR tokens. Version 2 of these contracts brings users PAR rewards and an APY boost. Additionally, PARMinerV2 can use its funds to liquidate protocol vaults through the liquidation feature.

See further documentation [here](https://github.com/code-423n4/2022-04-mimo/tree/main/core/docs/liquidity-mining/v2/README.md).

Contracts can be found in the [core/contracts/liquidityMining/v2](https://github.com/code-423n4/2022-04-mimo/tree/main/core/contracts/liquidityMining/v2) folder.

To only run the tests for Liquidity Mining V2 please run `yarn hardhat test test/liquidityMining/v2/*.test.ts` in the `core/` folder.

### LP Token Oracles

The BalancerV2 and a G-UNI LP token oracle adds support for using LP tokens as stablecoin collateral. The LP token oracle will return the LP token’s USD price  to be used in our PriceFeed contract.

The pricing of the LP token is based on [Alpha Finance's fair LP token pricing](https://blog.alphafinance.io/fair-lp-token-pricing/).

Contracts can be found in the [core/contracts/oracles](https://github.com/code-423n4/2022-04-mimo/tree/main/core/contracts/oracles) folder.

To only run the tests for LP Token Oracles please run `yarn hardhat test test/oracles/*.test.ts` in the `core/` folder.

### SuperVaults

A new, completely standalone feature built on top of our core protocol, Aave and Paraswap/1Inch.

SuperVaults expand the capabilities of the Mimo Protocol to integrate with DeFi aggregators and lending protocols to do things like:

- Enter leveraged positions on collateral
- Rebalance vaults to use different collaterals
- Pay off debt from vaults without any additional required capital

Technical and User documentation is [here](https://github.com/code-423n4/2022-04-mimo/tree/main/supervaults/docs), and general documentation is [here](https://github.com/code-423n4/2022-04-mimo/tree/main/supervaults/).

Contracts can be found in the [supervaults/contracts](https://github.com/code-423n4/2022-04-mimo/tree/main/supervaults/contracts) folder.

## Files in Scope

File|blank|comment|code
:-------|-------:|-------:|-------:
core/contracts/dex/DexAddressProvider.sol|8|13|34
core/contracts/dex/interfaces/IDexAddressProvider.sol|6|1|17
core/contracts/inception/AdminInceptionVault.sol|25|54|127
core/contracts/inception/InceptionVaultFactory.sol|28|6|151
core/contracts/inception/InceptionVaultsCore.sol|45|77|214
core/contracts/inception/InceptionVaultsDataProvider.sol|23|61|92
core/contracts/inception/interfaces/IAdminInceptionVault.sol|21|2|38
core/contracts/inception/interfaces/IInceptionVaultFactory.sol|19|2|47
core/contracts/inception/interfaces/IInceptionVaultPriceFeed.sol|11|1|20
core/contracts/inception/interfaces/IInceptionVaultsCore.sol|26|2|55
core/contracts/inception/interfaces/IInceptionVaultsDataProvider.sol|17|3|27
core/contracts/inception/priceFeed/ChainlinkInceptionPriceFeed.sol|18|13|71
core/contracts/libraries/ABDKMath64x64.sol|65|209|426
core/contracts/liquidityMining/v2/DemandMinerV2.sol|13|20|72
core/contracts/liquidityMining/v2/GenericMinerV2.sol|53|93|189
core/contracts/liquidityMining/v2/interfaces/IDemandMinerV2.sol|14|1|20
core/contracts/liquidityMining/v2/interfaces/IGenericMinerV2.sol|18|6|35
core/contracts/liquidityMining/v2/interfaces/ISupplyMinerV2.sol|5|2|8
core/contracts/liquidityMining/v2/interfaces/IVotingMinerV2.sol|2|1|5
core/contracts/liquidityMining/v2/PARMinerV2.sol|63|111|256
core/contracts/liquidityMining/v2/SupplyMinerV2.sol|8|12|32
core/contracts/liquidityMining/v2/VotingMinerV2.sol|13|15|44
core/contracts/oracles/BalancerV2LPOracle.sol|17|44|109
core/contracts/oracles/GUniLPOracle.sol|16|25|85
--------|--------|--------|--------
SUM:|534|774|2174

----------------------------------------------------------------------------------


File|blank|comment|code
:-------|-------:|-------:|-------:
supervaults/contracts/SuperVault.sol|43|91|239
supervaults/contracts/SuperVaultFactory.sol|9|1|19
--------|--------|--------|--------
SUM:|52|92|258
