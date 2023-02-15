# Modifying the integration tests

This document is a short guide on how to add new integration tests.

Before starting you should read the entire [design](/docs/design) and [spec](/docs/spec) document sets. As well as
run the [environment setup](/docs/developer/environment-setup.md)

## Basic structure

The integration tests build and launch a docker container with an Ethereum chain,
a 3 validator Cosmos chain running the Gravity bridge, and a 'test runner'.

The [test runner](/orchestrator/test_runner/src/main.rs) is a single rust binary that coordinates the actual test logic, as well as spawns
the Orchestrators and relayers.

The Ethereum backend for this test changes depending on which flow is being run.

A local Geth instance, with it's version defined in the [dockerfile](/tests/dockerfile/Dockerfile) and it's parameters defined in the [ETHGenesis.json](/tests/assets/ETHGenesis.json)

Or a HardHat instance that is actually launched from the Solidity tools folder and configured with the [hardhat.config.ts](/solidity/hardhat.config.ts).

Geth is chosen for nearly all tests. HardHat backed tests require an [Alchemy](https://auth.alchemyapi.io) API key so that they may test using production Ethereum data.

Exactly what test uses what Ethereum backend is decided in [run-testnet.sh](/tests/container-scripts/run-testnet.sh)

Both Ethereum backends are configured to deposit tokens into a hardcoded address in the test runner. This address is also the deposit destination for the [contract-deployer.ts](/solidity/contract-deployer.ts) when it creates some test ERC20 contracts.

The test runner module contains some logic for running the contract deployer and parsing the resulting ERC20 and Gravity.sol contract addresses. This is all done before we get into starting the actual tests logic.

## Adding tests

In order to add a new test define a new test_type environmental variable in the test runners `main.rs` file from there you can create a new file containing the test logic templated off of the various existing examples.

The [happy_path_test](/orchestrator/test_runner/src/happy_path.rs) for example uses several repeatable utility functions to

- start the orchestrators (with integrated relaying turned on)
- generate keys for test users
- deposit ERC20 tokens for those test users
- test validator set updates

Every test should perform some action and then meticulously verify that it actually took place. It is especially important to go off the happy path and ensure correct functionality.
