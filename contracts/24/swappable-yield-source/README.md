<p align="center">
  <a href="https://github.com/pooltogether/pooltogether--brand-assets">
    <img src="https://github.com/pooltogether/pooltogether--brand-assets/blob/977e03604c49c63314450b5d432fe57d34747c66/logo/pooltogether-logo--purple-gradient.png?raw=true" alt="PoolTogether Brand" style="max-width:100%;" width="200">
  </a>
</p>

<br />

# PoolTogether Swappable Yield Source

[![Mainnet fork](https://github.com/pooltogether/swappable-yield-source/actions/workflows/fork.yml/badge.svg)](https://github.com/pooltogether/swappable-yield-source/actions/workflows/fork.yml)
[![Coveralls](https://github.com/pooltogether/swappable-yield-source/actions/workflows/coveralls.yml/badge.svg)](https://github.com/pooltogether/swappable-yield-source/actions/workflows/coveralls.yml)
[![Coverage Status](https://coveralls.io/repos/github/pooltogether/swappable-yield-source/badge.svg?branch=main)](https://coveralls.io/github/pooltogether/swappable-yield-source?branch=main)
[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)

Wraps any [PoolTogether Yield Source](https://docs.pooltogether.com/protocol/yield-sources) and adds the ability to swap between any PoolTogether Yield Source.

# Usage

## Deployment

Follow [Installation](#installation) instructions.

The Swappable Yield Source needs to be initialized with a PoolTogether Yield Source.

Yield Source addresses are available in `Constants.ts`.

To initialize the Swappable Yield Source with the Yield Source you want to use, you need to modify the following line in `deploy/deploy.ts`:
https://github.com/pooltogether/swappable-yield-source/blob/71b6810f821ff8eadc2b11238524054c3f5b836f/deploy/deploy.ts#L104


To deploy, run:
`yarn deploy <NETWORK_NAME>`

## Development

Clone this repository and enter the directory.

### Installation

Install dependencies:

```
yarn
```

This project uses [Yarn 2](https://yarnpkg.com), dependencies should get installed pretty quickly.

### Env

We use [direnv](https://direnv.net) to manage environment variables. You'll likely need to install it.

Copy `.envrc.example` and write down the env variables needed to run this project.
```
cp .envrc.example .envrc
```

Once your env variables are setup, load them with:
```
direnv allow
```

### Test

We use the [Hardhat](https://hardhat.org) ecosystem to test and deploy our contracts.

First, you will need to deploy contracts in local.

Start the hardhat node by running: `yarn start-fork`

Then to deploy contracts locally, run: `yarn deploy-fork`

To run unit tests:

```
yarn test
```

To run [solhint](https://protofire.github.io/solhint/) and tests:

```
yarn verify
```

To run coverage:

```
yarn coverage
```

### Mainnet fork

Before deploying, you can make sure your implementation works by deploying a Yield Source Prize Pool and swapping the Yield Source on a fork of Mainnet.

Start Mainnet fork in a terminal window with the command:

```
yarn start-fork
```

In another window, start the scripts to deploy and create a Aave Yield Source Prize Pool, deposit Dai into it, swap to another Yield Source, award the prize and withdraw.

```
yarn run-fork
```

You can also run these commands concurrently with:

```
yarn mainnet-fork
```

### Deploy

Deployment script can be found in `deploy/deploy.ts`. To deploy, simply run:
```
yarn deploy <NETWORK_NAME>
```

Once deployment is done, you can verify your contracts on [Etherscan](https://etherscan.io) by typing:

```
yarn etherscan-verify <NETWORK_NAME>
```

### Code quality

[Prettier](https://prettier.io) is used to format TypeScript code. Use it by running:

```
yarn format
```

[Solhint](https://protofire.github.io/solhint/) is used to lint Solidity files. Run it with:
```
yarn hint
```

[TypeChain](https://github.com/ethereum-ts/Typechain) is used to generates types for scripts and tests. Generate types by running:
```
yarn typechain
```
