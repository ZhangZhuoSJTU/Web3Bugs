# Badger Citadel contest details

- $71,250 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-04-badger-citadel-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts April 14, 2022 00:00 UTC
- Ends April 20, 2022 23:59 UTC


![](./docs/images/citadel-knights.png)
> Assemby of the Knights

The high-level concepts and progress updates can be found on [Medium](https://thecitadeldao.medium.com/).

An [informal video](https://drive.google.com/file/d/1hCzQrgZEsbd0t2mtuaXm7Cp3YS-ZIlw3/view?usp=sharing) offering a summary of the smart contracts.


# Getting Started

## Prerequisites

- [Foundry](https://github.com/gakonst/foundry)
- [Node.js & NPM](https://nodejs.org/en/)
- [NPX](https://www.npmjs.com/package/npx)

## Installation

Install and update submodules:

```console
git submodule init
git submodule update
```

## Installation

Install hardhat dependencies:

```console
npm install
```

## Compilation

```
forge build
```

## Tests

Because the tests interact with mainnet contracts, tests must be run in mainnet fork mode.

```
forge test --fork-url <mainnet-rpc-url>
```

> ⚠️ Some tests are currently failing, they are under active development

## Hardhat deploy

Hardhat Ganace is more reliable than ganache itself for UI testing so we provide an integration with hardhat as well.
This will be run the deploy script on default network, but don't be shy to use other hardhat options for it

```
npx hardhat run scripts/deploy-local.js
```

# System Overview
An informal video offering a [summary of the system](https://drive.google.com/file/d/1hCzQrgZEsbd0t2mtuaXm7Cp3YS-ZIlw3/view?usp=sharing).

# Contract / Subsystem Overviews
- [Access Control](https://github.com/code-423n4/2022-04-badger-citadel/blob/main/docs/access-control.md)
- [Citadel Token](https://github.com/code-423n4/2022-04-badger-citadel/blob/main/docs/citadel-token.md)
- [Staked Citadel](https://github.com/code-423n4/2022-04-badger-citadel/blob/main/docs/staked-citadel.md)
- [Locked Citadel](https://github.com/code-423n4/2022-04-badger-citadel/blob/main/docs/locked-citadel.md)
- [Emissions and Distribution](https://github.com/code-423n4/2022-04-badger-citadel/blob/main/docs/emissions.md)
- [Knighting Round](https://github.com/code-423n4/2022-04-badger-citadel/blob/main/docs/knighting-round.md)
- [Oracles](https://github.com/code-423n4/2022-04-badger-citadel/blob/main/docs/oracles.md)
- [Other](https://github.com/code-423n4/2022-04-badger-citadel/blob/main/docs/explainer.md)

# Code4rena: Audit Scope & Assumptions
- Assume all allocated role permissions are correct in the setup of the system.
    - e.g. holders of CONTRACT_GOVERNANCE_ROLE won't rug or set malicious permissions for other roles.
    - However, if roles can be set in an unintended manner, this is a very valid finding, 

    See [BaseFixture.sol](https://github.com/code-423n4/2022-04-badger-citadel/blob/main/src/test/BaseFixture.sol) for how the system components are wired together in practice.

## What's in scope?
* All (non-test) contracts in this repo.
* The [modified convex locker](https://github.com/Citadel-DAO/staked-citadel-locker/blob/main/src/StakedCitadelLocker.sol) from our staked-citadel-locker repo.
* The [MedianOracle](https://github.com/ampleforth/market-oracle/blob/master/contracts/MedianOracle.sol) from ampleforth.
