# LI.FI contest details

- $71,250 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-03-Lifi-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts March 24, 2022 00:00 UTC
- Ends March 30, 2022 23:59 UTC

## Contest scope

All solidity files in the `src` folder except `src/Interfaces/*` and `src/Libraries/LibBytes.sol`.

| File                                                             | Docs                                 | SLOC | External contracts called | Libraries used |
| ---------------------------------------------------------------- | ------------------------------------ | ---- | ------------------------- | -------------- |
| [LiFiDiamond.sol](./src/LiFiDiamond.sol)                         |                                      | 39   | 0                         | 1              |
|                                                                  |                                      |      |                           |                |
| **Facets - Logic**                                               |                                      |      |                           |                |
| [Swapper.sol](./src/Facets/Swapper.sol)                          | ([docs](./docs/Swapper.md))          | 15   | 0                         | 2              |
| [AnyswapFacet.sol](./src/Facets/AnyswapFacet.sol)                | ([docs](./docs/AnyswapFacet.md))     | 97   | 2                         | 4              |
| [CBridgeFacet.sol](./src/Facets/CBridgeFacet.sol)                | ([docs](./docs/CBridgeFacet.md))     | 117  | 1                         | 3              |
| [HopFacet.sol](./src/Facets/HopFacet.sol)                        | ([docs](./docs/HopFacet.md))         | 129  | 1                         | 3              |
| [NXTPFacet.sol](./src/Facets/NXTPFacet.sol)                      | ([docs](./docs/NXTPFacet.sol))       | 122  | 1                         | 3              |
| [GenericSwapFacet.sol](./src/Facets/GenericSwapFacet.sol)        | ([docs](./docs/GenericSwapFacet.md)) | 23   | 0                         | 1              |
|                                                                  |                                      |      |                           |                |
| **Facets - Management**                                          |                                      |      |                           |                |
| [OwnershipFacet.sol](./src/Facets/OwnershipFacet.sol)            |                                      | 12   | 0                         | 1              |
| [DiamondCutFacet.sol](./src/Facets/DiamondCutFacet.sol)          |                                      | 13   | 0                         | 1              |
| [DiamondLoupeFacet.sol](./src/Facets/DiamondLoupeFacet.sol)      |                                      | 37   | 0                         | 1              |
| [WithdrawFacet.sol](./src/Facets/WithdrawFacet.sol)              |                                      | 28   | 1                         | 1              |
| [DexManagerFacet.sol](./src/Facets/DexManagerFacet.sol)          |                                      | 59   | 0                         | 2              |
|                                                                  |                                      |      |                           |                |
| **Libraries**                                                    |                                      |      |                           |                |
| [LibAsset.sol](./src/Libraries/LibAsset.sol)                     | ([docs](./docs/LibAsset.md))         | 67   | 1                         | 0              |
| [LibBytes.sol](./src/Libraries/LibBytes.sol) (Not part of audit) | ([docs](./docs/LibBytes.md))         | 291  | 0                         | 0              |
| [LibDiamond.sol](./src/Libraries/LibDiamond.sol)                 | ([docs](./docs/LibDiamond.md))       | 171  | 0                         | 0              |
| [LibStorage.sol](./src/Libraries/LibStorage.sol)                 | ([docs](./docs/LibStorage.md))       | 5    | 0                         | 0              |
| [LibSwap.sol](./src/Libraries/LibSwap.sol)                       | ([docs](./docs/LibSwap.md))          | 50   | 1                         | 2              |
| [LibUtil.sol](./src/Libraries/LibUtil.sol)                       | ([docs](./docs/LibUtil.md))          | 10   | 0                         | 1              |

The following risks should be given special consideration during the audit:

- Malicious calls (in [LibSwap.sol](./src/Libraries/LibSwap.sol))
- Access to other users funds
- Compromise access control

## Planned improvements

We are planning to to improve the LibSwap libraries to not only check the exchange calls using a contract address whitelist, but also use a function signature whitelist to ensure that only known functions are called in those contracts.

# LI.FI Smart Contracts

## Table of contents

1. [General](#general)
2. [Why LI.FI?](#why)
   1. [Our Thesis](#thesis)
   2. [Ecosystem Problems](#ecosystem-problems)
   3. [Developer Problems](#developer-problems)
   4. [Solution](#solution)
3. [How It Works](#how-it-works)
4. [Architecture](#architecture)
   1. [Contract Flow](#contract-flow)
   2. [Diamond Helper Contracts](#diamond-helper-contracts)
5. [Repository Structure](#repository-structure)
6. [Getting Started](#getting-started)
   1. [INSTALL](#install)
   2. [TEST](#test)
7. [Contract Docs](#contract-docs)
8. [More Information](#more-information)

## General<a name="general"></a>

Our vision is to create a middle layer between DeFi infrastructure and the application layer.
LI.FI aims to aggregate and abstract away the most important bridges and connect them to DEXs and DEX aggregators on each chain to facilitate cross-chain any-2-any swaps.

To decide which bridge to use, we assess and measure the degree of decentralization, trust assumptions, fees, gas efficiency, speed, and other qualitative and quantitative factors.
Then, we use the thresholds and preferences of our integration partners and end-users to select the right path.

## Why LI.FI?<a name="why"></a>

### Our Thesis<a name="thesis"></a>

- The future is multi-chain
- Cross-chain bridging solutions will play a major role on infrastructure level
- Aggregation will pave the way for mass adoption

---

### Ecosystem Problems<a name="ecosystem-problems"></a>

**dApps**: Many users come across a new interesting dApp on a chain they don't have funds in and struggle to get their funds there. This is significant friction in user onboarding as they have to research and find bridges to that chain to start using the dApp.

**Yield Aggregators**: There are definitely protocols with better yield on new L2/side-chains but there isn't a secure, reliable way to transfer your funds.

**Wallets**: Multichain wallets want to compete with CEXes, but they don't have a way to allow easy swap between assets like CEXes.

**DeFi Protocols**: DeFi Dashboards, lending protocols, yield farms, etc., that are present on new chains create a need to do cross-chain swaps, but their users have to wander the ecosystem to quench this need.

---

### Developer Problems<a name="developer-problems"></a>

**Too many bridges** to educate yourself about.
It'd be good to have access to all of them and getting good guidance from people and algorithms that are specialized.

➔ Li.Fi does that.

**Bridges are still immature** so it's good to have not only one bridge but fallback solutions in place.
Immaturity comes with security risks, insufficient liquidity and a lot of maintenance overhead.

➔ Li.Fi maintains all bridge connections, gives you access to multiple ones and handles fallbacks and decision-making programmatically.

**Bridges are most often not enough**.
You also need DEXes/DEX aggregators as bridges are limited to stable-coins and native currencies.

➔ Li.Fi not only aggregates bridges, but also connects to sorts of DEX aggregators and if not available, the DEXs directly in order to find the best swap possible to arrive at the desired token and to allow to start the whole process with any asset.

---

### Solution<a name="solution"></a>

A data mesh of cross-chain liquidity sources: cross-chain liquidity networks, bridges, DEXes, bridges, and lending protocols.

As a bridge and DEX aggregator, Li.Fi can route any asset on any chain to the desired asset on the desired chain, thus providing a remarkable UX to their users.

All of this will be made available on an API/Contract level which comes as SDK, iFrame solution, and as a widget for other developers to plug directly into their products.
No need for users to leave your dApps anymore.

## How It Works<a name="how-it-works"></a>

Our [API](https://apidocs.li.finance/) and [SDK](https://docs.li.finance/official-documentation/integrate-li.fi-natively/li.fi-sdk) allow dApps and dApp developers to request the best routes for a desired cross-chain swap.
Our backend will calculate the best possible routes based on the transaction fees, gas costs and execution duration.

The then returned routes contain already populated transactions which can directly be sent via the user's wallet to our contracts.
A single transaction can contain multiple steps (e.g. AAVE on Polygon -> DAI on Polygon using Paraswap -> DAI on Avalanche using NXTP -> SPELL on Avalanche using Paraswap) which will be executed by our contract.
Finally, the final amount of the requested token is sent to the user's wallet.

## Architecture<a name="architecture"></a>

The LI.FI Contract is built using the EIP-2535 (Multi-facet Proxy) standard. The contract logic lives behind a single contract that in turn uses DELEGATECALL to call **facet** contracts that contain the business logic.

All business logic is built using **facet** contracts which live in `src/Facets`.

For more information on EIP-2535 you can view the entire EIP [here](https://eips.ethereum.org/EIPS/eip-2535).

---

### Contract Flow<a name="contract-flow"></a>

A basic example would be a user bridging from one chain to another using Hop Protocol. The user would interact with the LI.FIDiamond contract which would pass the Hop specific call to the HopFacet which then passes required calls + parameters to Hop Protocol's contracts.

The basic flow is illustrated below.

```mermaid
graph TD;
    D{LiFiDiamond}-- DELEGATECALL -->NXTPFacet;
    D{LiFiDiamond}-- DELEGATECALL -->HopFacet;
    D{LiFiDiamond}-- DELEGATECALL -->AnyswapFacet;
    D{LiFiDiamond}-- DELEGATECALL -->CBridgeFacet;
```

---

### Diamond Helper Contracts<a name="diamond-helper-contracts"></a>

The LiFiDiamond contract is deployed along with some helper contracts that facilitate things like upgrading facet contracts, look-ups for methods on facet contracts, ownership checking and withdrawals of funds. For specific details please check out [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535).

```mermaid
graph TD;
    D{LiFiDiamond}-- DELEGATECALL -->DiamondCutFacet;
    D{LiFiDiamond}-- DELEGATECALL -->DiamondLoupeFacet;
    D{LiFiDiamond}-- DELEGATECALL -->OwnershipFacet;
    D{LiFiDiamond}-- DELEGATECALL -->WithdrawFacet;
```

## Repository Structure<a name="repository-structure"></a>

```
contracts
│ README.md                   // you are here
│ ...                         // setup and development configuration files
│
├─── config                   // service configuration files
├─── constants                // general constants
├─── deploy                   // deployment scripts
├─── diamondABI               // Diamond ABI definition
├─── export                   // deployed results
│
├─── src                      // the contract code
│   ├── Facets                // service facets
│   ├── Interfaces            // interface definitions
│   └── Libraries             // library definitions
│
├───tasks
│   │ generateDiamondABI.ts   // script to generate Diamond ABI including all facets
│
├─── test                     // contract unit tests
│   ├─── facets               // facet tests
│   ├─── fixtures             // service fixtures for running the tests
│   └─── utils                // testing utility functions
│
└─── utils                    // utility scripts
```

## Contract Docs<a name="contract-docs"></a>

You can read more details documentation on each facet [here](./docs/README.md).
Sample requests to fetch transactions for each facet can be found at the end of each section.

## Getting Started<a name="getting-started"></a>

Make sure to copy `.env.example` to `.env` and fill out the missing values.

### INSTALL<a name="install"></a>

```bash
yarn
```

### TEST<a name="test"></a>

```bash
yarn test
```

## More Information<a name="more-information"></a>

- [Website](https://li.fi/)
- [General Documentation](https://docs.li.finance/)
- [API Documentation](https://apidocs.li.finance/)
- [SDK Documentation](https://docs.li.finance/official-documentation/integrate-li.fi-natively/li.fi-sdk)
- [Transfer UI](https://transferto.xyz/)
