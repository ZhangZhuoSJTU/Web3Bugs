<p align="center">
  <a href="https://github.com/pooltogether/pooltogether--brand-assets">
    <img src="https://github.com/pooltogether/pooltogether--brand-assets/blob/977e03604c49c63314450b5d432fe57d34747c66/logo/pooltogether-logo--purple-gradient.png?raw=true" alt="PoolTogether Brand" style="max-width:100%;" width="200">
  </a>
</p>

<br />

# PoolTogether mStable Yield Source

PoolTogether Yield Source that uses [mStable](https://mstable.org/) to generate yield by depositing a mStable asset, eg mUSD, into a mStable interest-bearing savings contract, eg imUSD.

# Usage

## Installation

Install dependencies:

```
yarn
```

## Compile

To compile the Solidity contracts and generate the contract types and factories:

```
yarn run compile 
```

The contract ABIs are output to [/abis](./abis).

The Hardhat build artifacts are output to `/build`.

The contract types are output to [/types/pooltogether](./types/pooltogether).

Typescript outputs to [/dist](./dist).

## Test

We use [Hardhat](https://hardhat.org), [Ethers V5](https://docs.ethers.io/v5/), [Waffle](https://ethereum-waffle.readthedocs.io/) and [Chai](https://www.chaijs.com/) matchers for testing.

To run unit tests:

```
yarn test
```

To run coverage:

```
yarn coverage
```

### Mainnet fork

To run tests against local fork of mainnet

```
export NODE_URL=https://eth-mainnet.alchemyapi.io/v2/<your key>
yarn test:fork
```

The forks tests are in [test-fork/poolTogether.spec.ts](./test-fork/poolTogether.spec.ts).

## Deployment

A Hardhat task is used for deployment to mainnet using Open Zeppelin's [Defender Relay](https://docs.openzeppelin.com/defender/relay) wallet. Create and API key for the Relay wallet; export the API key and secret as per the below; and then delete the API key so it can not be used again.

```
export DEFENDER_API_KEY=<Open Zeppelin Defender Relay API key>
export DEFENDER_API_SECRET=<Open Zeppelin Defender Relay API secret>
yarn deploy --masset mUSD
```

The deployment task can be found in [tasks/poolTogether.ts](./tasks/poolTogether.ts).

### Code quality

[Prettier](https://prettier.io) is used to format TypeScript code. Use it by running:

```
yarn format
```

### Flatten for contract verification

```
yarn run flatten
```

Output to the `_flat` folder.
