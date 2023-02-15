# 👾 Welcome to Mellow Protocol

![](bg.png)

Hello legends! 💪

🧐 We look forward to you dissecting our code and helping us improve the security! Feel free to ask any small or big questions, and ask for guidance or clarifications.

❗️ Please pay attention to the docs and shoot any questions you have on Discord - we’ll be online to respond 💬 .

## Contest Details
- $45,000 USDC main award pot
- $5,000 gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2021-12-mellow-protocol-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts December 2, 2021 00:00 UTC
- Ends December 8, 2021 23:59 UTC

# Useful links 🧐

[Protocol documentation](https://docs.mellow.finance/) – the most complete information about the contracts

[Contract API](https://docs.mellow.finance/mellow-permissionless-vaults/api) – gitbook docs generated from contracts

[Vaults design article](https://mellowprotocol.medium.com/mellow-protocol-vaults-design-ed09bed7b869) – protocol design overview (Medium)

[Twitter](https://twitter.com/Mellowprotocol) | [Discord](https://discord.gg/w6sJDJrV65) | [Website](https://mellow.finance/)

# Contest Scope 🎓

The following contracts are in scope:

|File|Blank|Comment|Code
|-|-|-|-|
| contracts/LpIssuer.sol                                |                   35      |       48      |      278  
| contracts/UniV3Vault.sol                              |                   24      |       11      |      209
| contracts/GatewayVault.sol                            |                   19      |       12      |      197
| contracts/LpIssuerGovernance.sol                      |                   26      |       60      |      188
| contracts/ProtocolGovernance.sol                      |                   35      |       31      |      183
| contracts/Vault.sol                                   |                   30      |       60      |      177
| contracts/VaultGovernance.sol                         |                   34      |       54      |      158
| contracts/trader/UniV3Trader.sol                      |                   16      |        4      |      151
| contracts/VaultRegistry.sol                           |                   23      |       34      |      110
| contracts/libraries/CommonLibrary.sol                 |                    6      |       22      |       98
| contracts/ERC20Vault.sol                              |                   11      |        9      |       86
| contracts/GatewayVaultGovernance.sol                  |                   12      |       32      |       81
| contracts/trader/ChiefTrader.sol                      |                   13      |        8      |       81
| contracts/AaveVault.sol                               |                   11      |       23      |       76
| contracts/YearnVault.sol                              |                   11      |       23      |       75
| contracts/YearnVaultGovernance.sol                    |                   12      |       25      |       60
| contracts/libraries/ExceptionsLibrary.sol             |                    1      |        2      |       53
| contracts/AaveVaultGovernance.sol                     |                    8      |       18      |       42
| contracts/UniV3VaultGovernance.sol                    |                    7      |       18      |       42
| contracts/ERC20VaultGovernance.sol                    |                   10      |       18      |       39
| contracts/DefaultAccessControl.sol                    |                    4      |        8      |       17
| contracts/LpIssuerFactory.sol                         |                    4      |        5      |       16
| contracts/UniV3VaultFactory.sol                       |                    4      |        7      |       16
| contracts/AaveVaultFactory.sol                        |                    4      |        5      |       15
| contracts/ERC20VaultFactory.sol                       |                    4      |        5      |       15
| contracts/GatewayVaultFactory.sol                     |                    4      |        5      |       15
| contracts/YearnVaultFactory.sol                       |                    4      |        5      |       15
| contracts/trader/Trader.sol                           |                    4      |        2      |       13
| contracts/trader/libraries/TraderExceptionsLibrary.sol |                   1      |        1      |       13
| **TOTAL**                           |                    377      |        555      |       2519

## Invariants that should uphold at all times ✅

1. Strategy (approved ERC721 person) should not be able to pull the funds anywhere outside of the vault system
2. Liquidity provider shall be able to withdraw funds at all times
3. No one should be able to withdraw smth with zero investment (i.e. no arbitrage / exploits is possible).
4. No one can block withdrawing or claim funds which doesn't not belong to him
5. Governance cannot withdraw liquidity provider funds (with the exception of tokens which are not managed by the Vault)
6. Governance cannot block liquidity provider funds for withdrawing
7. Bad actor on governance side cannot permanently lock protocol / pools / etc
8. VaultTokens are sorted by address in any vault

## Contact us 📲

Feel free to ping us:

| Name | Discord        |
| ------- | --------------- |
| Alex    | @AlexK#7957     |
| Mikhail | @Mikhail S#8699 |
| Nick    | @0xn1ck#9123    |

We're happy to answer any questions and discuss every suggestion.

# Protocol overview 🔮

**We're buliding permissionless vaults ecosystem for trustless automatic DeFi strategies.
The protocol is designed for implementing multi-token cross-protocol liquidity rebalancing.**

The Vault contracts hold the tokens and rebalance them both inside other protocols and between them. Strategy contracts interact with Vault contracts definig the rebalancing parameters.

**Liquidity provider**

Users pick a strategy that fits their needs and allocate their assets into a vault to earn yield. When the assets are deposited, users get composable LP tokens (ERC-20).

**Strategies**

Strategies are smart-contracts that implement the models to provide effective liquidity allocation. Different market events can trigger the strategies to initiate rebalance.

**Vaults**

Vaults allocate multiple ERC-20 tokens into other DeFi protocols and rebalance the liquidity in accordance with Strategies inside and between the protocols.

A typical vault and strategy setup would be made by using Mellow Permissioless Vaults _deployVault_ function. As a result, the following set of smart contracts (called Vault System) would be established **for every strategy and token pair**:
<img src="https://miro.medium.com/max/1400/1*GeSO8eJ8WZUEjgko8V3LkQ.gif" width="640">


## Protocol architecture 🛠

![](https://miro.medium.com/max/2000/1*L4INk2ZLKCylmw1Yt28JTw.png)
There are two types of contracts on the diagram:

1.  **Protocol contracts** (pink color) — these are the protocol contracts that are deployed in one instance;
2.  **Vault contracts** (purple color) — these are the contracts deployed by users (vault owners/strategists) by using **protocol contracts.** Essentially everyone can create a set of Vault contracts.

We can logically separate contracts into Vault Groups. Each Vault Group is a set of contracts that allows managing and creating a vault of a specific Vault Kind. Vault Governance is a contract that can:

1.  Deploy a new vault via a VaultGovernance#deployVault method
2.  Manage governance params for specific vaults

Upon Vault creation, the Vault Registry contract mints a new ERC-721 token that represents that Vault.

## Contracts overview 📟

**AaveVault**

Vault that interfaces Aave protocol in the integration layer.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#aavevault).

**AaveVaultFactory**

Helper contract for `AaveVaultGovernance` that can create new Aave Vaults.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#aavevaultfactory).

**AaveVaultGovernance**

Governance that manages all Aave Vaults params and can deploy a new Aave Vault.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#aavevaultgovernance).

**YearnVault**

Vault that interfaces Yearn protocol in the integration layer.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#yearnvault).

**YearnVaultFactory**

Helper contract for `YearnVaultGovernance` that can create new Yearn Vaults.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#yearnvaultfactory).

**YearnVaultGovernance**

Governance that manages all Yearn Vaults params and can deploy a new Yearn Vault.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#yearnvaultgovernance).

**UniV3Vault**

Vault that interfaces UniV3 protocol in the integration layer.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#univ3vault).

**UniV3VaultFactory**

Helper contract for `UniV3VaultGovernance` that can create new UniV3 Vaults.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#univ3vaultfactory).

**UniV3VaultGovernance**

Governance that manages all UniV3 Vaults params and can deploy a new UniV3 Vault.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#univ3vaultgovernance).

**ERC20Vault**

Vault that stores ERC20 tokens.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#erc20vault).

**ERC20VaultFactory**

Helper contract for `ERC20VaultGovernance` that can create new ERC20 Vaults.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#erc20vaultfactory).

**ERC20VaultGovernance**

Governance that manages all ERC20 Vaults params and can deploy a new ERC20 Vault.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#erc20vaultgovernance).

**GatewayVault**

Vault that combines several integration layer Vaults into one Vault.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#gatewayvault).

**GatewayVaultFactory**

Helper contract for `GatewayVaultGovernance` that can create new Gateway Vaults.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#gatewayvaultfactory).

**GatewayVaultGovernance**

Governance that manages all Gateway Vaults params and can deploy a new Gateway Vault.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#gatewayvaultgovernance).

**LpIssuer**

Contract that mints and burns LP tokens in exchange for ERC20 liquidity.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#lpissuer).

**LpIssuerFactory**

Helper contract for `LpIssuerGovernance` that can create new Lp Issuers.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#lpissuerfactory).

**LpIssuerGovernance**

Governance that manages all LpIssuers params and can deploy a new LpIssuer.
[See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#lpissuergovernance).

**Vault**

Abstract contract that has logic common for every Vault. [See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#vault).

**VaultGovernance**

Internal contract for managing different params. [See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#vaultgovernance).

**ProtocolGovernance**

Governance that manages all params common for Mellow Permissionless Vaults protocol. [See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#protocolgovernance).

**DefaultAccessControl**

This is a default access control with 2 roles - ADMIN and ADMIN_DELEGATE. [See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#defaultaccesscontrol).

**CommonLibrary**

Common shared utilities

**ChiefTrader**

Main contract that allows trading of ERC20 tokens on different Dexes. [See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#chieftrader).

**UniV3Trader**

Contract that can execute ERC20 swaps on Uniswap V3. [See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#univ3trader).

**Trader**

Base contract for every trader contract (a contract that can execute ERC20 swaps). [See details](https://docs.mellow.finance/mellow-permissionless-vaults/api#trader).

### External calls made by our contracts:

- Aave
  - LendingPool: `deposit`, `withdraw`, `getReserveData`
  - aTokens: `balanceOf`
- Uniswap
  - Router: `exactInput`, `exactOutput`
  - NonfungiblePositionManager: `increaseLiquidity`, `decreaseLiquidity`, `collect`, `positions`
- Yearn
  - Yearn Vault Registry: `latestVault`
  - yTokens: `deposit`, `withdraw`, `balanceOf`

## How we protect the protocol 🔐

VaultRegistry mints a unique ERC721 NFT for each Vault. Access control is based on that NFTs:

1. Nft Owner can freely push and pull liquidity from the vault
2. Nft approved person can push, but pull only to other vaults which are in the same [Vault System](https://docs.mellow.finance/mellow-permissionless-vaults/definitions#vault-system)
3. ERC-721 ApprovedForAll cannot do anything (i.e. irrelevant to access control)

Additionally Protocol Governance admin can perform certain tasks on protocol management and emergency shutdown:

1. Disable / migrate strategies (by changing approve rights for Nfts in VaultRegistry)
2. Set strategy and protocol params on VaultGovernance level, incl setting deposit limits to 0
3. Reclaiming tokens that are sent by mistake on vaults

Only tokens whitelisted by Protocol Governance can be used for creating new Vaults.

## Setup, tests, etc. 🪄

See Contracts [README.md](https://github.com/code-423n4/2021-12-mellow/blob/main/mellow-vaults/README.md)

### Run unit tests

Required env variables (could be addred to `.env` file):

```
MAINNET_RPC=<ethereum rpc endpoint>
KOVAN_RPC=<ethereum rpc endpoint>
```

MAINNET_RPC should be able to serve acrhive node api. E.g. [Alchemy](https://www.alchemy.com/) can do that.

```bash
yarn
yarn coverage
```

**Tests coverage report**

```bash
open coverage/index.html
```

### Deploy

Required env variables (could be added to `.env` file):

```
MAINNET_RPC=<ethereum rpc endpoint>
KOVAN_RPC=<ethereum rpc endpoint>
MAINNET_DEPLOYER_PK=0x.... # for mainnet deploy
KOVAN_DEPLOYER_PK=0x.... # for kovan deploy
```

```bash
yarn
yarn deploy:hardhat
# or yarn deploy:kovan
# or yarn deploy:mainnet
```

### Check contract size

```bash
yarn
yarn size
```


### Good luck and may the Force be with you!✨
