# boot-vesting
Vesting Contract

## Features
* The aim is to giveaway BOOT tokens linearly on a weekly basis.
* It's aimed for team members, seed investors, private sale, airdrop (for Swerve token holders).
* It is a token holder contract which releases tokens (for usage) as per the planned schedule. [Source](https://docs.google.com/spreadsheets/d/15E74yhvS63s1N4svF_RNSoy2D_G5vFH715DODlevNxI/edit#gid=855556220)
* Here, the admin has the authority to revoke/unrevoke address as team member during leaving/rejoining the company.

## Installation

```bash
$ npm install
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
$ npx hardhat run --network localhost deployment/hardhat/vesting.ts
```

You can connect to this RPC server via `localhost:8545`.

### Deploying contracts to Rinkeby Testnet
* Environment variables
	- Create a `.env` file with its values:
```
DEPLOYER_PRIVATE_KEY=<private_key_without_0x>
INFURA_API_KEY=<SECRET_KEY>
REPORT_GAS=<true_or_false>
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

