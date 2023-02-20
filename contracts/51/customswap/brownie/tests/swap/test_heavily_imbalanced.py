import pytest
from brownie import chain

pytestmark = pytest.mark.usefixtures("add_initial_liquidity", "mint_bob", "approve_bob")


@pytest.mark.itercoins("idx")
def test_imbalanced_swaps(alice, bob, swap, coins, initial_amounts, n_coins, idx):
    # deposit 1,000x the initial amount in a single asset, leaving the pool ~99.9% imbalanced
    amounts = [0] * n_coins
    amounts[idx] = initial_amounts[idx] * 1000
    coins[idx]._mint_for_testing(alice, amounts[idx], {"from": alice})
    swap.addLiquidity(amounts, 0, chain.time() + 60, {"from": alice})

    swap_indexes = [i for i in range(n_coins) if i != idx]

    # make a few swaps where the input asset is the one we already have too much of
    # bob is getting rekt here, but the contract shouldn't bork
    for i in swap_indexes:
        swap.swap(idx, i, initial_amounts[idx] // n_coins, 0, chain.time() + 60, {"from": bob})

    # now we go the other direction, swaps where the output asset is the imbalanced one
    # lucky bob is about to get rich!
    for i in swap_indexes:
        amount = initial_amounts[i]
        swap.swap(i, idx, amount, 0, chain.time() + 60, {"from": bob})
