# Tigris Trade contest details
- Total Prize Pool: $90,500 USDC
    - HM awards: $63,750 USDC
    - QA report awards: $7,500 USDC
    - Gas report awards: $3,750 USDC
    - Judge + presort awards: $15,000
    - Scout awards: $500 USDC
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-12-tigris-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts December 09, 2022 20:00 UTC
- Ends December 16, 2022 20:00 UTC

## C4udit / Publicly Known Issues

The C4audit output for the contest can be found [here](https://gist.github.com/Picodes/341209cd106cfdaaba80610fc76cbe56) within an hour of contest opening.

_Note for C4 wardens: Anything included in the C4udit output is considered a publicly known issue and is ineligible for awards._

# Overview

Tigris is a leveraged trading platform that utilizes price data signed by oracles off-chain to provide atomic trades and real-time
pair prices.
Open positions are minted as NFTs, making them transferable. Tigris is governed by Governance NFT holders.

The oracle aggregates real-time spot market prices from CEXs and sign them. Traders include the price data and signature in the trade txs.

For people that want to provide liquidity, they can lock up tigAsset tokens (such as tigUSD,
received by depositing the appropriate token into the stablevault) for up to 365 days. They will receive trading fees
through an allocation of Governance NFTs, which get distributed based on amount locked and lock period.

[Project documentation](https://tigristrade.gitbook.io/)

[LayerZero Docs](https://layerzero.gitbook.io/)

# Scope

*List all files in scope in the table below -- and feel free to add notes here to emphasize areas of focus.*

| Contract                                                 | SLOC | Purpose                                                                                                         | Libraries used |  
|----------------------------------------------------------|------|-----------------------------------------------------------------------------------------------------------------| ----------- |
| contracts/Trading.sol                                    | 794  | Contains most trading contract logic                                                                            | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)|
| contracts/TradingExtension.sol                           | 195  | Some trading logic is delegated this contract                                                                   | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)|
| contracts/utils/TradingLibrary.sol                       | 76   | Verifies oracle signature, calculates PnL and liquidation price. Checks against Chainlink's public price feeds. | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)|
| contracts/Position.sol                                   | 219  | Position NFT that stores all position data                                                                      | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)|
| contracts/PairsContract.sol                              | 106  | Stores info about pairs such as open interest and fees                                                          | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)|
| contracts/Referrals.sol                                  | 56   | Stores referral codes and referred addresses                                                                    | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)|
| contracts/GovNFT.sol                                     | 263  | NFT that utilizes LayerZero for bridging and contains token reward distribution logic                           | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)|
| contracts/StableToken.sol                                | 46   | Mintable and burnable ERC20                                                                                     | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)|
| contracts/StableVault.sol                                | 66   | Holds liquidity for StableToken                                                                                 | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)|
| contracts/Lock.sol                                       | 87   | Manages bond interaction logic for end-users                                                                    | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)|
| contracts/BondNFT.sol                                    | 284  | Bond NFTs minted by locking StableTokens and is managed by Lock.sol                                             | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)|
| contracts/utils/MetaContext.sol                          | 27   | Context overridden for meta transactions                                                                        | [`@openzeppelin/*`](https://openzeppelin.com/contracts/)|
| contracts/interfaces/IBondNFT.sol                        | 36   | Bond interface                                                                                                  |                                                         |
| contracts/interfaces/IGovNFT.sol                         | 7    | Gov NFT interface                                                                                               |                                                         |
| contracts/interfaces/ILayerZeroEndpoint.sol              | 19   | LayerZero endpoint interface                                                                                    |                                                         |
| contracts/interfaces/ILayerZeroReceiver.sol              | 4    | LayerZero receiver interface                                                                                    |                                                         |
| contracts/interfaces/ILayerZeroUserApplicationConfig.sol | 7    | LayerZero Config interface                                                                                      |                                                         |
| contracts/interfaces/IPairsContract.sol                  | 22   | Pairs contract interface                                                                                        |                                                         |
| contracts/interfaces/IPosition.sol                       | 48   | Position NFT interface                                                                                          |                                                         |
| contracts/interfaces/IReferrals.sol                      | 7    | Referrals contract interface                                                                                    |                                                         |
| contracts/interfaces/IStableVault.sol                    | 7    | StableVault interface                                                                                           |                                                         |
| contracts/interfaces/ITrading.sol                       | 101  | ITrading interface                                                                                              |                                                         |

## Out of scope

1. contracts/Forwarder.sol
2. contracts/Faucet.sol
3. contracts/NFTSale.sol
4. contracts/Timelock.sol
5. contracts/Forwarder.sol
6. contracts/GovNFTBridged.sol
7. contracts/utils/ExcessivelySafeCall.sol
8. contracts/mock/*
9. External libraries: ``@openzeppelin/*``
10. deployments folder (note: the source code of the deployments is different from the code currently being audited)

# Additional Context

- Signatures will be valid for 2-5 sec depending on the chain.
- BlockDelay would be ~2x valid signature time in blocks.
- Governance NFTs use LayerZero for bridging.
- The two external calls are LayerZero's endpoint and chainlink public price feed.

## Scoping Details
```
- If you have a public code repo, please share it here:  Repo is private
- How many contracts are in scope?:   22
- Total SLoC for these contracts?:  2477
- How many external imports are there?:  4
- How many separate interfaces and struct definitions are there for the contracts within scope?:  20
- Does most of your code generally use composition or inheritance?:   yes
- How many external calls?:   2
- What is the overall line coverage percentage provided by your tests?:  98.5%
- Is there a need to understand a separate part of the codebase / get context in order to audit this part of the protocol?:  false 
- Please describe required context:   
- Does it use an oracle?:  true; our own signature-based oracle
- Does the token conform to the ERC20 standard?:  true
- Are there any novel or unique curve logic or mathematical models?: none
- Does it use a timelock function?:  yes
- Is it an NFT?: we have 2 nfts
- Does it have an AMM?:   no
- Is it a fork of a popular project?:   false
- Does it use rollups?:   true
- Is it multi-chain?:  true
- Does it use a side-chain?: true
```

# Tests
## Hardhat:
1. Clone the repo
2. Install dependencies
3. ``npx hardhat test`` for gas reports
4. ``npx hardhat coverage`` for coverage

