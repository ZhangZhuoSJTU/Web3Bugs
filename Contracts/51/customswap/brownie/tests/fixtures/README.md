# curve-contract/tests/fixtures

Pytest fixtures used in Curve's test suite.

## Files

* [`accounts.py`](accounts.py): Convenience fixtures to aid readability when accessing specific accounts
* [`coins.py`](coins.py): Deployment fixtures for stablecoins and LP tokens
* [`functions.py`](functions.py): Functions-as-fixtures, used to standardize contract interactions or to access commonly needed functionality
* [`setup.py`](setup.py): Test setup fixtures, used for common processes such as adding initial liquidity or approving token transfers

## Fixtures

### `accounts.py`

Session scoped convenience fixtures providing access to specific unlocked accounts. These are used to aid readability within the test suite.

* `admin`: Yields `web3.eth.accounts[0]`. This is the deployer address for all contracts.
* `alice`: Yields `web3.eth.accounts[0]`. This adds liquidity via add_initial_liquidity fixture.
* `bob`: Yields `web3.eth.accounts[1]`.
* `charlie`: Yields `web3.eth.accounts[2]`.

### `coins.py`

Module scoped deployment fixtures for stablecoins and pool LP tokens.

* `liquidity`: the LPToken associated with the Swap contract.
* `swap`: [`Swap`](../../contracts/pool-templates) deployment for the Swap contract.

### `functions.py`

Fixtures-as-functions that are used to standardize contract interafces or access commonly needed functionality.

* `approx`: Comparison function for confirming that two numbers are equal within a relative precision.
* `get_admin_balances`: Function for querying the current admin balances of the active `swap` deployment. This is required because some older pool contracts do not include an `admin_balances` function.

### `setup.py`

Module scoped setup fixtures, used for common processes such as adding initial liquidity or approving token transfers.

Setup fixtures are commonly applied using [`pytestmark`](https://docs.pytest.org/en/latest/reference.html#globalvar-pytestmark) and the [`usefixtures`](https://docs.pytest.org/en/latest/reference.html#pytest-mark-usefixtures) marker:

```python
pytestmark = pytest.mark.usefixtures("add_initial_liquidity", "mint_bob")
```

* `add_initial_liquidity`: Mints and approves `initial_amounts` coins for `alice` and adds them to `swap` to provide initial liquidity.
* `approve_alice`: Approves `swap` for unlimited transfers of all underlying and wrapped coins from `alice`.
* `approve_bob`:Approves `swap` for unlimited transfers of all underlying and wrapped coins from `bob`.
* `mint_alice`: Mints `initial_amounts` of each underlying and wrapped coin for `alice`.
* `mint_bob`: Mints `initial_amounts` of each underlying and wrapped coin for `bob`.
