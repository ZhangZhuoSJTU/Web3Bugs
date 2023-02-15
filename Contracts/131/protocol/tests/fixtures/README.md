# Fixtures

The Pytest fixtures used in the Backd protocol test suite are:

- `deployments.py`: Deployed contract fixtures
- `mainnet_deployments.py`: Fixtures for currently deployed contracts on mainnet
- `accounts.py`: Ethereum accounts for transactions
- `coins.py`: Fixtures for ensuring the same instances of coins are used across tests and other fixtures
- `mocks.py`: Curve contract mock fixtures
- `setup.py`: Fixtures used for setting up other fixtures

The following subsections will outline the individual fixtures used:

## [Deployments](fixtures/deployments.py)

Module-scoped fixtures for deployments.

- `pool`: Deployment for the liquidity pool.
- `controller`: Deployment for the controller.
- `topUpAction`: Deployment for the top up action.
- `stakerVault`: Deployment for the staker vault.
- `vault`: Deployment for `vault`. This fixture also does the following set up:

  - set initial vault parameters to `0`
  - set `vault` admin to `pool`
  - set strategy to `strategy`
  - activate `strategy`
  - set `strategy` admin to `vault`

- `strategy`: Deployment of strategy. By default this is a `MockEthStrategy` or `MockErc20Strategy` (depending on `coin`).
- `math_funcs`: Deployment of math funcs wrapper.
- `mockStrategy`: Deployment of a MockErc20Strategy.
- `topUpActionFeeHandler`: Deployment of top up action fee handler.

## [Mainnet Deployments](fixtures/mainnet_deployments.py)

Module-scoped fixtures for deployments.

- `mainnet_controller`: Mainnet deployment for the Controller.
- `mainnet_address_provider`: Mainnet deployment for the Address Provider.
- `mainnet_chainlink_oracle_provider`: Mainnet deployment for the Chainlink Oracle Provider.
- `mainnet_pools`: Mainnet deployment for all Pools.
- `mainnet_usdc_pool`: Mainnet deployment for the USDC Pool.
- `mainnet_usdc_vault`: Mainnet deployment for the USDC Vault.
- `mainnet_usdc_strategy`: Mainnet deployment for the USDC Strategy.
- `mainnet_eth_pool`: Mainnet deployment for the ETH Pool.
- `mainnet_eth_vault`: Mainnet deployment for the ETH Vault.
- `mainnet_eth_strategy`: Mainnet deployment for the ETH Strategy.

## [Accounts](fixtures/accounts.py)

Session-scoped fixtures used for Ethereum accounts.

- `alice`: Yields `web3.eth.accounts[0].
- `bob`: Yields `web3.eth.accounts[1].
- `charlie`: Yields `web3.eth.accounts[2].
- `admin`: Yields `web3.eth.accounts[3]. This is also the deployer of all contracts.
- `gov`: Yields `web3.eth.accounts[4].
- `treasury`: Yields `web3.eth.accounts[5].

## [Coins](fixtures/coins.py)

Module-scoped fixtures for the deployed coins that are used by tests and other fixtures.

- `coin`: Deployment of the underlying coin of the liquidity `pool`. This is set in the `testconf.json` configuration file. By default a `MockErc20` contract is deployed.
- `decimals`: Decimals of `coin`.
- `lpToken`: Deployment of the liquidity `pool`'s LP token.
- `curveCoin`: List of all coins in the Curve pool (`curveSwap`).

## [Mocks](fixtures/mocks.py)

Module-scoped fixtures for mocking Curve contracts. The Curve mock contracts are located [here](contracts/testing/Curve).

- `curveLpToken`: Deployment fixture for the LP token of a Curve pool.
- `crv`: Yields a `MockErc20` contract to represent the CRV ERC20 token.
- `curveMinter`: Deployment fixture of the minter contract.
- `curveSwap`: Deployment fixture of a Curve stable swap pool. If the liquidity pool's `coin` is DAI or USDC, then a [3Pool implementation](contracts/testing/Curve/MockCurveSwap.vy) is used. For ETH, the [ETH/SETH pool implementation](contracts/testing/Curve/MockCurveSwapETH.vy) is used.
- `curveGauge`: Deployment fixture for a Curve liquidity gauge for `curveLpToken`.

## [Setup](fixtures/setup.py)

Function-scoped fixtures for setting up module scoped contract fixtures.

- `approveAlice`: Infinite approval for `coin` given to the liquidity pool (`pool`) by `alice`.
- `approveBob`: Infinite approval for `coin` given to the liquidity pool (`pool`) by `bob`.
- `initialAmount`: The initial liquidity that is minted for `alice` and `bob`.
- `mintAlice`: Mint `initialAmount` for `alice`.
- `mintBob`: Mint `initialAmount` for `bob`.
- `addInitialLiquidity`: Add `initialAmount` of `coin` to `pool` by `alice`.
- `mintLpAlice`: Mint `initialAmount` of `pool` LP tokens for `alice`.
- `curveInitialLiquidity`: Adds 100,000 of each underlying coin to the Curve pool.
- `initialAmounts`: The initial amounts that are added to the Curve pool (not scaled).
- `curveSetUp`: Calls `curveInitialLiquidity` and approves the Curve pool to take funds from `alice`.
