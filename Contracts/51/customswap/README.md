# saddle-contract

[![codecov](https://codecov.io/gh/saddle-finance/saddle-contract/branch/master/graph/badge.svg?token=CI26SD9SGE)](https://codecov.io/gh/saddle-finance/saddle-contract)
[![CI](https://github.com/saddle-finance/saddle-contract/workflows/CI/badge.svg)](https://github.com/saddle-finance/saddle-contract/actions?query=workflow%3ACI)

The smart contracts behind [saddle.finance](https://saddle.finance) 🤠

The contracts are compiled with [Hardhat](https://hardhat.org/getting-started/), and tested using [Waffle](https://hardhat.org/guides/waffle-testing.html#testing-with-ethers-js-waffle) and [TypeScript](https://hardhat.org/guides/typescript.html#typescript-support).

## Installation

```bash
$ npm i
```

## Usage

### Build

```bash
$ npm run build
```

### Test

```bash
$ npm test
```

### Coverage

```bash
$ npm run coverage
```

### Deploying contracts to localhost Hardhat EVM

```bash
$ npx hardhat node
$ npx hardhat run --network localhost deployment/hardhat/swap.ts
```

`deployment/hardhat/swap-forkMainnet.ts` is also available for forking the mainnet contracts into the hardhat network.

You can connect to this RPC server via `localhost:8545`.

### Deploying contracts to Rinkeby Testnet
* Environment variables
	- Create a `.env` file with its values:
```
DEPLOYER_PRIVATE_KEY_RINKEBY=<private_key_without_0x>
INFURA_API_KEY=<SECRET_KEY>
REPORT_GAS=<true_or_false>
```

#### BTC tokens pool
```bash
$ npx hardhat run deployment/rinkeby/swap-btc.ts --network rinkeby
```

#### FRAX-FXS pool
```bash
$ npx hardhat run deployment/rinkeby/swap-frax.ts --network rinkeby
```

### Generating GitBook docs

```bash
$ npx solidity-docgen --templates=templates
```

The output in the `docs` folder should be copied to the appropriate folder in the [saddle-docs repo](https://github.com/saddle-finance/saddle-docs/tree/master/solidity-docs).

### Running Slither

[Slither](https://github.com/crytic/slither) is a Solidity static analysis framework. To run it locally:

```bash
$ pip3 install slither-analyzer
$ slither .
```

Slither is configured to run as a GitHub Action and error on any high findings.

## Brownie

It is recommended that you create a virtualenv with direnv or other suitable shell helpers when developing or running the brownie tests and other Python based tools.  Make sure your Python 3.7+ virtualenv is configured and activated before running these commands.

Also, since Brownie uses Ganache, make sure you have npm 14+ installed.

```bash
$ pip install -r requirements.txt
$ brownie test
```
