# PoolTogether V4 Periphery Contracts

![Tests](https://github.com/pooltogether/v4-periphery/actions/workflows/main.yml/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/pooltogether/v4-periphery/badge.svg?branch=master)](https://coveralls.io/github/pooltogether/v4-periphery?branch=master)
[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)
[![GPLv3 license](https://img.shields.io/badge/License-GPLv3-blue.svg)](http://perso.crans.org/besson/LICENSE.html)

<strong>Have questions or want the latest news?</strong>
<br/>Join the PoolTogether Discord or follow us on Twitter:

[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.gg/JFBPMxv5tr)
[![Twitter](https://badgen.net/badge/icon/twitter?icon=twitter&label)](https://twitter.com/PoolTogether_)

**Documention**<br>
https://docs.pooltogether.com

**Deplyoments**<br>
- [Ethereum](https://docs.pooltogether.com/resources/networks/ethereum)
- [Matic](https://docs.pooltogether.com/resources/networks/matic)

# Overview
- [PrizeFlush](/contracts/PrizeFlush.sol)

The `PrizeFlush` contract wraps multiple draw completition steps: capturing/distributing interest, and automically transfering the captured interest to DrawPrizes. The contract is **simple in nature** and is expeced to evolve with the V4 rollout and governance requirements.

As the draw and prize distribution params are optimized with continual hypothesis and testing, the PoolTogether Community and Governance process can "codify" the rules for an optimal interest distribution - adding intermediary steps to fine-tuning prize models and optimal interes allocation.

**Core and Timelock contracts:**

- https://github.com/pooltogether/v4-core
- https://github.com/pooltogether/v4-timelocks

# Getting Started

The project is made available as a NPM package.

```sh
$ yarn add @pooltogether/pooltogether-contracts
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

## Deploy Locally

Start a local node and deploy the top-level contracts:

```bash
$ yarn start
```

NOTE: When you run this command it will reset the local blockchain.

