# PoolTogether V4 Periphery Contracts

![Fork](https://github.com/pooltogether/v4-periphery/actions/workflows/fork.yml/badge.svg)
![Tests](https://github.com/pooltogether/v4-periphery/actions/workflows/main.yml/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/pooltogether/v4-periphery/badge.svg?branch=master)](https://coveralls.io/github/pooltogether/v4-periphery?branch=master)
[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)
[![GPLv3 license](https://img.shields.io/badge/License-GPLv3-blue.svg)](http://perso.crans.org/besson/LICENSE.html)

<strong>Have questions or want the latest news?</strong>
<br/>Join the PoolTogether Discord or follow us on Twitter:

[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.gg/JFBPMxv5tr)
[![Twitter](https://badgen.net/badge/icon/twitter?icon=twitter&label)](https://twitter.com/PoolTogether_)

**Documentation**<br>
https://v4.docs.pooltogether.com

**Deployments**<br>
- [Ethereum](https://v4.docs.pooltogether.com/protocol/deployments/mainnet#mainnet)
- [Polygon](https://v4.docs.pooltogether.com/protocol/deployments/mainnet#polygon)
- [Avalanche](https://v4.docs.pooltogether.com/protocol/deployments/mainnet#avalanche)

# Overview
- [PrizeDistributionFactory](/contracts/PrizeDistributionFactory.sol)
- [PrizeFlush](/contracts/PrizeFlush.sol)
- [PrizeTierHistory](/contracts/PrizeTierHistory.sol)
- [TwabRewards](/contracts/TwabRewards.sol)

# Getting Started

The project is made available as a NPM package.

```sh
$ yarn add @pooltogether/v4-periphery
```

The repo can be cloned from Github for contributions.

```sh
$ git clone https://github.com/pooltogether/v4-periphery
```

```sh
$ yarn
```

We use [direnv](https://direnv.net/) to manage environment variables.  You'll likely need to install it.

```sh
cp .envrc.example .envrc
```

# Testing

We use [Hardhat](https://hardhat.dev) and [hardhat-deploy](https://github.com/wighawag/hardhat-deploy)

To run unit tests:

```sh
$ yarn test
```

To run coverage:

```sh
$ yarn coverage
```

# Forking

Mainnet fork tests have been implemented to test the functionalities of the TWAB Rewards contract.

To start the mainnet fork RPC server, run:

```sh
$ yarn start-fork
```

To run the mainnet fork tests for the TWAB Rewards contract, run:

```sh
$ yarn twab-rewards-fork
```

If you wish to run both at the same time, run:

```sh
$ yarn run-twab-rewards-fork
```

This command is used in the Github Actions workflow located in `.github/workflows/fork.yml`.


# Deployment

## Testnets
Deployment is maintained in a different [repo](https://github.com/pooltogether/v4-testnet).

## Mainnet
Deployment is maintained in a different [repo](https://github.com/pooltogether/v4-mainnet).
