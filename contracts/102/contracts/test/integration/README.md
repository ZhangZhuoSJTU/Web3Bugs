# Integration Tests
These are integration tests that are used to validate interactions with other protocols.

To add a new test, ensure that the name of the contract test file includes `IntegrationTest`. The `forge` test command uses a regex of that string in order to run the `IntegrationTests` with the required mainnet keys etc.

## Purpose
These integration tests are primarily for rapid development and tight feedback loops when building an integration with a third party protocol. They allow you to fork mainnet to replicate state and can be run in two modes: default and `latest`. 

The default mode is run through `npm run test:integration`. It forks mainnet from a block number supplied through the environment variable `FORK_BLOCK`, in order to make use of caching and so speed up the tests. To change the block from which the tests fork, change the `env` variable set in the `package.json` command.

There is also a `latest` mode, run through `npm run test:integraton:latest`. This forks from the latest Mainnet block and allows you to run the integration tests in a manner that validates against the latest state on mainnet. It does not make use of caching. This is used in CI.

## How to run
Make sure an environment variable `MAINNET_ALCHEMY_API_KEY` is in the namespace where you execute integration test commands:

**Dev mode**
`MAINNET_ALCHEMY_API_KEY=x npm run test:integration`

**Latest mode**
`MAINNET_ALCHEMY_API_KEY=x npm run test:integration:latest`