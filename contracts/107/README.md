# JPEG'd contest details

- $95,000 USDC main award pot
- $5,000 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-04-jpegd-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts April 7, 2022 00:00 UTC
- Ends April 13, 2022 23:59 UTC

## Glossary

| Name                               | Description                                                         |
| ---------------------------------- | ------------------------------------------------------------------- |
| JPEG'd DAO                         | DAO governing the JPEG'd DeFi protocol                              |
| JPEG                               | Governance token for JPEG'd DAO                                     |
| sJPEG                              | Token representing staked JPEG                                      |
| PUSd                               | Stablecoin minted by the DeFi protocol                              |
| CDP / Collateralized Debt Position | A loan backed by some form of collateral                            |
| LTV / Loan to Value                | Ratio of the debt position to the value of the collateral deposited |
| Curve pool                         | Liquidity pool on Curve AMM for stablecoin swaps                    |
| LP token                           | Token representing a share of a liquidity pool                      |
| yVault                             | Vault that invests into an underlying strategy for yield generation |

# Contest Scope

This contest is open for a week. Representatives from the JPEG'd team will be available to answer any questions in the Code Arena Discord. The focus for the contest is to find any bugs, logic errors, or improvements to the core contracts of the JPEG'd protocol. This may include, among other things, ensuring only owners of deposited NFTs can withdraw, PUSd cannot be minted outside of defined rules, and NFTs are kept safe in the vault contract. Wardens can assume that governance variables are set appropriately, and can reach out on Discord for any further clarification.

## Protocol overview

JPEG'd is a decentralized lending protocol on the Ethereum blockchain that enables non-fungible token (NFT) holders to open collateralized debt positions (CDPs) using their NFTs as collateral. Users mint PUSd, the native stablecoin of the protocol, enabling them to effectively obtain leverage on their NFTs.

The protocol will be managed by a governance token, JPEG, that will oversee, administer, and change parameters of the protocol.

JPEG'd is completely permissionless, decentralized, and is not controlled by any central entity. JPEG's aim is to bridge DeFi and NFTs and eventually allow any NFT collection, as voted upon by governance, to obtain a line of credit using their NFTs as collateral on the protocol.

## Smart Contracts

The core of the protocol is the `NFTVault` contract, containing the logic for lending PUSd to users based upon their NFT collateral. As CryptoPunks and EtherRocks predate modern NFT standards, their respective helper contracts are used by `NFTVault` to implement ERC721 interfaces. PUSd can also be minted by the DAO using fungible assets, as managed by `FungibleAssetVaultforDAO`.

An overview of the system can be seen [here](https://whimsical.com/jpeg-d-dao-Lr5kmvULtzm2KKwwzdZaZL).

The full list of contracts to be reviewed is below, organized by directory.

### Escrow

#### NFTEscrow.sol (111 sloc)

Escrow contract for non ERC721 NFTs. Handles atomic non ERC721 NFT transfers by using `FlashEscrow`.

### Farming

#### LPFarming.sol (367 sloc)

JPEG'd LP Farming. Users can stake their JPEG'd ecosystem LP tokens to get JPEG rewards.

Known issue - due to how the `_withdrawReward` internal function behaves, in some circustances accrued user rewards are going to be stored in the `userRewards` mapping.
This behaviour lets users see and claim the amount of rewards stored in the mapping from any pool, regardless of the amount staked. Users will still get the overall correct amount of rewards.

Known errors in the natspec documentation for the newEpoch function - the new epoch's start block has to be greater than block.number, not the previous epoch's end block, and the function may be called during an epoch.

#### yVaultLPFarming.sol (193 sloc)

JPEG'd yVault token farm. Users can stake their JPEG'd vault tokens and earn JPEG rewards.

### Helpers

#### CryptoPunksHelper.sol (110 sloc)

CryptoPunks NFTVault helper contract. Allows compatibility between CryptoPunks and `NFTVault`.

#### EtherRocksHelper.sol (115 sloc)

EtherRocks NFTVault helper contract. Allows compatibility between EtherRocks and `NFTVault`.

### Lock

#### JPEGLock.sol (85 sloc)

JPEG Locker contract. Contract used by `NFTVault` to lock JPEG to increase the value of an NFT.

### Staking

#### JPEGStaking.col (59 sloc)

JPEG staking contract. Users can stake JPEG and get sJPEG back.

### Tokens

#### JPEG.sol (28 sloc)

JPEG - Governance token.

#### StableCoin.sol (84 sloc)

PUSd - JPEG'd Stablecoin. PUSd is minted by `NFTVault` (backed by NFTs) and `FungibleAssetVaultForDAO` (backed by fungible assets).

### Vaults

#### yvault/strategies/StrategyPUSDConvex.sol (432 sloc)

JPEG'd PUSd Convex autocompounding strategy. This strategy autocompounds Convex rewards from the PUSd/USDC/USDT/MIM Curve pool.

#### yvault/Controller.sol (168 sloc)

JPEG'd strategies controller. Allows members of the `STRATEGIST_ROLE` to manage all the strategies in the JPEG'd ecosystem.

#### yvault/yVault.sol (204 sloc)

JPEG'd yVault. Allows users to deposit fungible assets into autocompounding strategy contracts (e.g. `StrategyPUSDConvex`).

#### FungibleAssetVaultForDAO.sol (210 sloc)

Fungible asset vault (for DAO and ecosystem contracts). Allows the DAO and other whitelisted addresses to mint PUSd using fungible assets as collateral.

#### NFTVault.sol (952 sloc)

NFT lending vault. This contracts allows users to borrow PUSd using NFTs as collateral.
