import os

from brownie import DummyERC20  # type: ignore

from support.utils import get_deployer, abort, make_tx_params, with_gas_usage


TOKEN_NAME = os.environ.get("TOKEN_NAME")
TOKEN_SYMBOL = os.environ.get("TOKEN_SYMBOL")


@with_gas_usage
def main():
    if not TOKEN_NAME or not TOKEN_SYMBOL:
        abort("TOKEN_NAME and TOKEN_SYMBOL should be set")
    token = get_deployer().deploy(DummyERC20, TOKEN_NAME, TOKEN_SYMBOL, **make_tx_params())  # type: ignore
    token.mintAsOwner(100_000 * 10 ** 18)
