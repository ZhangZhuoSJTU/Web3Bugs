# Notional Trade Module  

## Content
This directory is a reduced copy of the [Set protocol repo](https://github.com/SetProtocol/set-protocol-v2).
The only contract in scope within this directory is the [NotionalTradeModule](contracts/protocol/modules/v1/NotionalTradeModule.sol) contract.

For further understanding of how this contract works you might want to take a look at the [unit](test/unit/notionalTradeModule.spec.ts) and [integration](test/integration/notionalTradeModule.spec.ts) intests which run similar test cases against a clean testchain or against main net fork respectively.


## Configuration

To enable running the integration tests against a mainnet fork you will have to coy `.env.default` to `.env` and replace the placeholder with your alchemy api key.

## Available Commands

### Install dependencies

`yarn install`

### Build Contracts

`yarn build`

### Run tests

Run unit tests:

`yarn test:unit`

Run integration tests (see configuration section above):

`yarn test:integration`

Run all tests:

`yarn test`
