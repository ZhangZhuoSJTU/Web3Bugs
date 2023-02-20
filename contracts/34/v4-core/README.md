
<p align="center">
  <a href="https://github.com/pooltogether/pooltogether--brand-assets">
    <img src="https://github.com/pooltogether/pooltogether--brand-assets/blob/977e03604c49c63314450b5d432fe57d34747c66/logo/pooltogether-logo--purple-gradient.png?raw=true" alt="PoolTogether Brand" style="max-width:100%;" width="400">
  </a>
</p>

<br />

# PoolTogether V4 Core Smart Contracts

![Tests](https://github.com/pooltogether/v4-core/actions/workflows/main.yml/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/pooltogether/v4-core/badge.svg?branch=master)](https://coveralls.io/github/pooltogether/v4-core?branch=master)
[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)
[![GPLv3 license](https://img.shields.io/badge/License-GPLv3-blue.svg)](http://perso.crans.org/besson/LICENSE.html)

<strong>Have questions or want the latest news?</strong>
<br/>Join the PoolTogether Discord or follow us on Twitter:

[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.gg/JFBPMxv5tr)
[![Twitter](https://badgen.net/badge/icon/twitter?icon=twitter&label)](https://twitter.com/PoolTogether_)

**Documention**<br>
https://docs.pooltogether.com

**Deployments**<br>
- [Ethereum](https://docs.pooltogether.com/resources/networks/ethereum)
- [Matic](https://docs.pooltogether.com/resources/networks/matic)

# Overview
- [DrawBeacon](/contracts/DrawBeacon.sol)
- [DrawCalculator](/contracts/DrawCalculator.sol)
- [DrawBuffer](/contracts/DrawBuffer.sol)
- [PrizeDistributor](/contracts/PrizeDistributor.sol)
- [PrizeSplitStrategy](/contracts/PrizeSplitStrategy.sol)
- [Reserve](/contracts/Reserve.sol)

Periphery and supporting contracts:

- https://github.com/pooltogether/v4-periphery
- https://github.com/pooltogether/v4-oracle-timelocks


# Getting Started

The project is made available as a NPM package.

```sh
$ yarn add @pooltogether/pooltogether-contracts
```

The repo can be cloned from Github for contributions.

```sh
$ git clone https://github.com/pooltogether/v4-core
```

```sh
$ yarn
```

We use [direnv](https://direnv.net/) to manage environment variables.  You'll likely need to install it.

```sh
cp .envrc.example .envrv
```

To run fork scripts, deploy or perform any operation with a mainnet/testnet node you will need an Infura API key.

# Testing

We use [Hardhat](https://hardhat.dev) and [hardhat-deploy](https://github.com/wighawag/hardhat-deploy)

To run unit & integration tests:

```sh
$ yarn test
```

To run coverage:

```sh
$ yarn coverage
```

# Fork Testing

Ensure your environment variables are set up.  Make sure your Alchemy URL is set.  Now start a local fork:

```sh
$ yarn start-fork
```

Setup account impersonation and transfer eth:

```sh
$ ./scripts/setup.sh
```

# Deployment

## Testnets
Deployment is maintained in a different [repo](https://github.com/pooltogether/v4-testnet).

## Mainnet
Todo: insert deployment repo link here.
