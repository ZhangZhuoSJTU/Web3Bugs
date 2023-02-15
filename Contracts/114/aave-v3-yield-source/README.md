<p align="center">
  <a href="https://github.com/pooltogether/pooltogether--brand-assets">
    <img src="https://github.com/pooltogether/pooltogether--brand-assets/blob/977e03604c49c63314450b5d432fe57d34747c66/logo/pooltogether-logo--purple-gradient.png?raw=true" alt="PoolTogether Brand" style="max-width:100%;" width="200">
  </a>
</p>

<br />

# PoolTogether Aave V3 Yield Source 👻

![Fork](https://github.com/pooltogether/aave-v3-yield-source/actions/workflows/fork.yml/badge.svg)
![Tests](https://github.com/pooltogether/aave-v3-yield-source/actions/workflows/coveralls.yml/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/pooltogether/aave-v3-yield-source/badge.svg)](https://coveralls.io/github/pooltogether/aave-v3-yield-source)
[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)
[![GPLv3 license](https://img.shields.io/badge/License-GPLv3-blue.svg)](http://perso.crans.org/besson/LICENSE.html)

PoolTogether Yield Source that uses [Aave](https://aave.com) V3 to generate yield by lending any ERC20 token deposited into the Yield Source to Aave.

## Development

Clone this repository and enter the directory:
```
cd aave-v3-yield-source
```

### Installation

Install dependencies:

```
yarn
```


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

### Compile

Run the following command to compile the contract:
```
yarn compile
```

### Test

We use the [Hardhat](https://hardhat.org) ecosystem to test our contracts.

To run unit tests:

```
yarn test
```

To run coverage:

```
yarn coverage
```

### Polygon fork

Before deploying, you can make sure your implementation works by deploying a Yield Source Prize Pool on a fork of Polygon.

To do so, run the following command:
```
yarn run-yield-source-fork
```


### Code quality

[Prettier](https://prettier.io) is used to format TypeScript and Solidity code. Use it by running:

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
