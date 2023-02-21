# Testing

We are using the foundry framework for all tests.

There exists a comprehensive suite of unit tests, fuzz tests and integration tests. Unless specified otherwise, fuzz tests can be found at the end of unit test files.

## Basic tests

```
forge test --gas-report
```

## Test coverage report

```
forge coverage
```

To generate a more detailed line-by-line report you will need [lcov](https://github.com/linux-test-project/lcov) installed.
It should be installed by default on linux. To install on OSX:

```
brew install lcov
```

Generate the report:

```
forge coverage --report lcov && genhtml lcov.info -o coverage && open coverage/index.html
```

## Static analysis

We use [slither](https://github.com/crytic/slither/) for static analysis. To install:

```
pip3 install slither-analyzer
pip3 install solc-select
solc-select install 0.8.17
solc-select use 0.8.17
```

Then run:

```
slither .
```

## Linting

For linting we use [solhint](https://github.com/protofire/solhint). To install:

```
npm install -g solhint
```

Then to run:

```
solhint ./src/**/*.sol
```
