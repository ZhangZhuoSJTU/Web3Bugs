# prePO Smart Contracts

This repository contains all the smart contracts for prePO V1.

## Child directories

More detailed readmes can be found in the child directories (ie core and token).

## Setup

### Visual Studio Code Extensions

- REQUIRED: solidity (Juan Blanco)
- REQUIRED: Prettier - Code formatter (Prettier)
- Better Comments (Aaron Bond)
- Bracket Pair Colorizer (CoenraadS)
- Guides (spywhere)
- indent-rainbow (oderwat)

### Install

Run `yarn`

### Commands

- Prettify Contracts: `yarn sl`
- Check Contract Styling: `yarn sh`
- Check Contract Sizes: `yarn size`
- Compile Contracts: `yarn c`
- Run Tests: `yarn t`
- Run Tests w/ Code Coverage: `yarn t:coverage`
- Prettify TypeScript files: `yarn l`

### Run Contract Tests & Get Callstacks

In one terminal run `yarn hardhat node`

Then in another run `yarn t`

### Configuration

- Edit `hardhat.config.ts` to setup connections to different networks
- Add your Infura API key and mnemonic to `.env`

## Deploy

### Deploy Locally

`yarn hardhat node` will launch a JSON-RPC node locally on `localhost:8545`.

Running `yarn hardhat node` without the `--no-deploy` tag will also execute everything defined in the `deploy` folder.

It is advised to instead run deployments separately using `yarn hardhat deploy` with specific `--tags` to ensure you only  
deploy what you need, e.g. `yarn hardhat deploy --network 'localhost' --tags 'Collateral'`

### Deploy to Network

The following command will allow you to specify an external Ethereum network to deploy your contract on:

`yarn hardhat --network <networkName> deploy --tags <tagName>`

### Verify on Blockchain Explorer

Add your Etherscan API key using ETHERSCAN_API_KEY in `.env`, then run:

`yarn hardhat verify <contractAddress> --network <networkName> "PARAM 1" "PARAM 2"...`

Polygonscan and Arbiscan are also recognized via POLYGONSCAN_API_KEY and ARBISCAN_API_KEY in `.env`
