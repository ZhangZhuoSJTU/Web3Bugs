# Test Suite

This is the test suite for the Backd contracts.

To run the full test suite, run:

```
brownie test
```

Components of the Backd protocol may be tested in either `development` or `mainnet-fork` mode. By default, the tests will run in `development` mode.

To run the tests in `mainnet-fork` mode, run:

```
brownie test --network mainnet-fork
```

## Test Suite Set Up

By default (i.e. `brownie test`) the full test suite will be run. Note that there is a set of [common tests](tests/common), which are applied to all liquidity pools by default. If a specific pool is to be tested via the `--pool` command line argument (see below), then only the specified pool will be tested against the common tests.

Depending on the underlying token of a liquidity pool, the pool will be tested against either the [erc20](tests/erc20) or [eth](tests/eth) tests.

The tests that are located outside of the `common`, `erc20` and `eth` directories are using a DAI liquidity pool by default (this should not affect the tests), unless specified otherwise through the `--pool` flag.

## Testing Pool Types

Liquidity pools belong to one of two types depending on the underlying asset: `erc20` liquidity pools or `eth` liquidity pools. To target only one of the two types in the tests, the `--type` flag can be set:

```
brownie test --type <POOL_TYPE`>
```

For example, to only target liquidity pools that hold an ERC20 token, run:

```
brownie test --type erc20
```

## Testing Individual Pools

The Backd protocol has the following liquidity pools:

- DAI
- USDC
- ETH

To target a specific pool, run:

```
brownie test --pool <NAME>
```

For instance, to run all tests for the DAI pool, run:

```
brownie test --pool dai
```

Each pool has a `testconf.json` configuration file (e.g. [for DAI](configs/dai_pool/testconf.json)) in it's own directory located within the `tests/configs` directory. The config stores data such as:

- `underlying` asset address
- `decimals` of underlying asset
- `name` of pool
- `symbol` of pool LP token
- `strategy` of the pool

This may be extended as the test suite is further developed.
