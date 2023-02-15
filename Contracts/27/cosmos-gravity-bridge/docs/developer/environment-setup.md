# Getting started

Welcome! This guide covers how to get your development machine setup to contribute to Gravity Bridge, as well as the basics of how the code is laid out.

If you find anything in this guide that is confusing or does not work, please open an issue or [chat with us](https://discord.com/invite/vw8twzR).

We're always happy to help new developers get started

## Language dependencies

Gravity bridge has three major components

[The Gravity bridge Solidity](https://github.com/althea-net/cosmos-gravity-bridge/tree/main/solidity) and associated tooling. This requires NodeJs
[The Gravity bridge Cosmos Module and test chain](https://github.com/althea-net/cosmos-gravity-bridge/tree/main/module). this requires Go.
[The Gravity bridge tools](https://github.com/althea-net/cosmos-gravity-bridge/tree/main/orchestrator) these require Rust.

### Installing Go

Follow the official guide [here](https://golang.org/doc/install)

Make sure that the go/bin directory is in your path by adding this to your shell profile (~/.bashrc or ~/.zprofile)

```
export PATH=$PATH:$(go env GOPATH)/bin
```

### Installing NodeJS

Follow the official guide [here](https://nodejs.org/en/)

### Installing Rust

Use the official toolchain installer [here](https://rustup.rs/)

### Alternate installation

If you are a linux user and prefer your package manager to manually installed dev dependencies you can try these.

**Fedora**
`sudo dnf install golang rust cargo npm -y`

**Ubuntu**
` audo apt-get update && sudo apt-get install golang rust cargo npm -y`

## Getting everything built

At this step download the repo

```
git clone https://github.com/althea-net/cosmos-gravity-bridge/
```

### Solidity

Change directory into the `cosmos-gravity-bridge/solidity` folder and run

```
# Install JavaScript dependencies
HUSKY_SKIP_INSTALL=1 npm install

# Build the Gravity bridge Solidity contract, run this after making any changes
npm run typechain
```

You should also try running the tests

```
# run the Hardhat Ethereum testing chain
npm run evm
```

In another terminal

```
# actually run the tests, connecting to the running EVM in your other terminal
npm run test
```

### Go

Change directory into the `cosmos-gravity-bridge/module` folder and run

```
# Update protobuf dependencies
make proto-update-deps

# Installing the protobuf tooling
sudo make proto-tools

# Install protobufs plugins
go get github.com/regen-network/cosmos-proto/protoc-gen-gocosmos
go get github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway
```

```
# generate new protobuf files from the definitions, this makes sure the previous instructions worked
# you will need to run this any time you change a proto file
make proto-gen

# build all code, including your newly generated go protobuf file
make

# run all the unit tests
make test
```

### Rust

Change directory into the `cosmos-gravity-bridge/orchestrator` folder and run

```
# build all crates
cargo build --all

# re-generate Rust protobuf code
# you will need to do this every time you edit a proto file
cd proto-build && cargo run
```

### Tips for IDEs

- We strongly recomend installing [Rust Analyzer](https://rust-analyzer.github.io/) in your IDE.
- Launch VS Code in /solidity with the solidity extension enabled to get inline typechecking of the solidity contract
- Launch VS Code in /module/app with the go extension enabled to get inline typechecking of the dummy cosmos chain

## Running the integration tests

We provide a one button integration test that deploys a full arbitrary validator Cosmos chain and testnet Geth chain for both development + validation.
We believe having a in depth test environment reflecting the full deployment and production-like use of the code is essential to productive development.

Currently on every commit we send hundreds of transactions, dozens of validator set updates, and several transaction batches in our test environment.
This provides a high level of quality assurance for the Gravity bridge.

Because the tests build absolutely everything in this repository they do take a significant amount of time to run.
You may wish to simply push to a branch and have Github CI take care of the actual running of the tests.

### Running the integration test environment locally

The integration tests have two methods of operation, one that runs one of a pre-defined series of tests, another that produces a running local instance
of Gravity bridge for you as a developer to interact with. This is very useful for iterating quickly on changes.

```
# builds the original docker container, only have to run this once
./tests/build-container.sh

# This starts the Ethereum chain, Cosmos chain, and a full set of Orchestrators + relayers
./tests/start-chains.sh
```

switch to a new terminal and run one of these two commands. A list of all predefined tests can be found [here](https://github.com/althea-net/cosmos-gravity-bridge/blob/main/orchestrator/test_runner/src/main.rs#L169)

```
# This runs a pre-defined test against the chains, keeping state between runs
./tests/run-tests.sh

# This provides shell access to the running testnet
# RPC endpoints are passed through the container to localhost:8545 (ethereum) and localhost:9090 (Cosmos GRPC)
docker exec -it gravity_test_instance /bin/bash
```

**Debugging**

To use a stepping debugger in VS Code, follow the "Working inside the container" instructions above, but set up a one node testnet using
`./tests/reload-code.sh 1`. Now kill the node with `pkill gravityd`. Start the debugger from within VS Code, and you will have a 1 node debuggable testnet.

### Running all up tests

All up tests are pre-defined test patterns that are run 'all up' which means including re-building all dependencies and deploying a fresh testnet for each test.
These tests _only_ work on checked in code. You must commit your latest changes to git.

A list of test patterns is defined [here](https://github.com/althea-net/cosmos-gravity-bridge/blob/main/orchestrator/test_runner/src/main.rs#L169)

To run an individual test run

```
bash tests/all-up-test.sh TEST_NAME
```

To run all the integraton tests and check your code completely run

```
bash tests/run-all-up-tests.sh
```

This will run every available all up test. This will take quite some time, go get coffee and if your development machine is
particularly slow I recomend just pushing to Github. Average runtime per all up test on a modern linux machine is ~5 minutes each.

You can also use

```
bash tests/run-all-tests.sh
```

This is essentially a local emulation of the Github tests. Including linting and formatting plus the above all up test script.

## Next steps

Now that you are ready to edit, build, and test Gravity Bridge code you can view the [code structure intro](/docs/developer/code-structure.md)
