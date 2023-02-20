import pytest

from brownie import reverts, interface
from support.utils import get_first_event, scale
from fixtures.coins import mint_coin_for
from support.mainnet_contracts import TokenAddresses

IMBALANCE_AMOUNT = 1_000_000

parameters = [
    # MIM # DAI
    {
        "convex_pid": 40,
        "curve_pool": "0x5a6A4D54456819380173272A5E8E9B9904BdF41B",
        "curve_index": 1,
        "curve_hop_pool": "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
        "curve_hop_index": 0
    },
    # UST # USDC
    {
        "convex_pid": 40,
        "curve_pool": "0x5a6A4D54456819380173272A5E8E9B9904BdF41B",
        "curve_index": 1,
        "curve_hop_pool": "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
        "curve_hop_index": 1
    },
    # MIM  # USDT
    {
        "convex_pid": 40,
        "curve_pool": "0x5a6A4D54456819380173272A5E8E9B9904BdF41B",
        "curve_index": 1,
        "curve_hop_pool": "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
        "curve_hop_index": 2
    },
]


# Fixtures
@pytest.fixture(params=parameters)
@pytest.mark.mainnetFork
def strategy_params(request):
    params = request.param
    return [params["convex_pid"], params["curve_pool"], params["curve_index"], params["curve_hop_pool"], params["curve_hop_index"]]


@pytest.fixture
@pytest.mark.mainnetFork
def strategy(BkdTriHopCvx, admin, alice, bob, address_provider, strategy_params):
    return admin.deploy(
        BkdTriHopCvx,
        bob,
        alice,
        strategy_params[0],
        strategy_params[1],
        strategy_params[2],
        strategy_params[3],
        strategy_params[4],
        address_provider
    )


@pytest.fixture
@pytest.mark.mainnetFork
def underlying(admin, alice, bob, strategy, underlyingDecimals):
    underlying_address = strategy.underlying()
    for account in [admin, alice, bob]:
        mint_coin_for(account, underlying_address, scale(500_000, underlyingDecimals))
    return interface.ERC20(underlying_address)


@pytest.fixture
@pytest.mark.mainnetFork
def underlyingDecimals(strategy):
    underlying_address = strategy.underlying()
    return interface.IERC20Full(underlying_address).decimals()


# Requires
@pytest.mark.mainnetFork
def test_revert_on_deposit_from_non_admin(strategy, alice):
    with reverts("unauthorized access"):
        strategy.deposit({"from": alice, "value": 1})


@pytest.mark.mainnetFork
def test_revert_on_deposit_when_shut_down(strategy, bob):
    tx = strategy.shutdown({"from": bob})
    assert len(tx.events) == 1
    with reverts("Strategy is shut down"):
        strategy.deposit({"from": bob, "value": 0})


@pytest.mark.mainnetFork
def test_revert_on_payment_to_deposit(strategy, bob):
    with reverts("invalid msg.value"):
        strategy.deposit({"from": bob, "value": 1})


@pytest.mark.mainnetFork
def test_revert_on_harvest_from_non_vault(strategy, admin):
    with reverts("unauthorized access"):
        strategy.harvest({"from": admin})


@pytest.mark.mainnetFork
def test_revert_on_withdraw_from_non_vault(strategy, admin):
    with reverts("unauthorized access"):
        strategy.withdraw(1, {"from": admin})


@pytest.mark.mainnetFork
def test_revert_on_withdraw_for_insufficient_balance(strategy, bob):
    with reverts():
        strategy.withdraw(1, {"from": bob})


@pytest.mark.mainnetFork
def test_revert_on_withdraw_all_from_non_admin(strategy, alice):
    with reverts("unauthorized access"):
        strategy.withdrawAll({"from": alice})


@pytest.mark.mainnetFork
def test_revert_on_add_reward_token_from_non_admin(strategy, alice, sushi):
    with reverts("unauthorized access"):
        strategy.addRewardToken(sushi, {"from": alice})


@pytest.mark.mainnetFork
def test_revert_on_add_reward_token_as_crv(strategy, admin, crv):
    with reverts("Invalid token to add"):
        strategy.addRewardToken(crv, {"from": admin})


@pytest.mark.mainnetFork
def test_revert_on_add_reward_token_as_cvx(strategy, admin, cvx):
    with reverts("Invalid token to add"):
        strategy.addRewardToken(cvx, {"from": admin})


@pytest.mark.mainnetFork
def test_revert_on_add_reward_token_as_underlying(strategy, admin, underlying):
    with reverts("Invalid token to add"):
        strategy.addRewardToken(underlying, {"from": admin})


@pytest.mark.mainnetFork
def test_revert_on_removing_reward_token_from_non_admin(strategy, alice, sushi):
    with reverts("unauthorized access"):
        strategy.removeRewardToken(sushi, {"from": alice})


@pytest.mark.mainnetFork
def test_deposit_starts_with_no_balance(strategy):
    assert strategy.balance() == 0


@pytest.mark.mainnetFork
def test_deposit_returns_false_with_no_balance(strategy, bob):
    tx = strategy.deposit({"from": bob, "value": 0})
    assert tx.return_value == False


@pytest.mark.mainnetFork
def test_deposit(
    strategy, underlying, admin, decimals, interface, bob, underlyingDecimals
):
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    balance = strategy.balance()
    assert balance == scale(10, underlyingDecimals)
    tx = strategy.deposit({"from": bob, "value": 0})
    assert tx.return_value == True
    assert strategy.balance() > scale(9, underlyingDecimals)
    assert strategy.balance() < scale(11, underlyingDecimals)
    crvRewards = interface.IRewardStaking(strategy.rewards())
    assert crvRewards.balanceOf(strategy) > scale(9, decimals)


@pytest.mark.mainnetFork
def test_withdraw_with_0_amount(strategy, bob):
    tx = strategy.withdraw(0, {"from": bob})
    assert tx.return_value == False


@pytest.mark.mainnetFork
def test_withdraw_with_idle_balance(
    strategy, underlying, admin, bob, underlyingDecimals
):
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    vaultBalanceBefore = underlying.balanceOf(bob)
    tx = strategy.withdraw(scale(5, underlyingDecimals), {"from": bob})
    vaultBalanceAfter = underlying.balanceOf(bob)
    assert get_first_event(tx, "Withdraw")["amount"] == scale(5, underlyingDecimals)
    assert tx.return_value == True
    assert vaultBalanceAfter - vaultBalanceBefore == scale(5, underlyingDecimals)
    assert underlying.balanceOf(strategy) < scale(6, underlyingDecimals)
    assert underlying.balanceOf(strategy) > scale(4, underlyingDecimals)


@pytest.mark.mainnetFork
def test_withdraw_with_all_deposited(
    strategy, underlying, admin, bob, decimals, interface, underlyingDecimals
):
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    strategy.deposit({"from": bob, "value": 0})
    vaultBalanceBefore = underlying.balanceOf(bob)
    tx = strategy.withdraw(scale(5, underlyingDecimals), {"from": bob})
    assert get_first_event(tx, "Withdraw")["amount"] == scale(5, underlyingDecimals)
    assert tx.return_value == True
    assert underlying.balanceOf(bob) - vaultBalanceBefore == scale(
        5, underlyingDecimals
    )
    crvRewards = interface.IRewardStaking(strategy.rewards())
    depositedBalance = crvRewards.balanceOf(strategy)
    assert depositedBalance < scale(6, decimals)
    assert depositedBalance > scale(4, decimals)


@pytest.mark.mainnetFork
def test_withdraw_with_some_deposited(
    strategy, underlying, admin, bob, decimals, interface, underlyingDecimals
):
    underlying.transfer(strategy, scale(4, underlyingDecimals), {"from": admin})
    strategy.deposit({"from": bob, "value": 0})
    underlying.transfer(strategy, scale(4, underlyingDecimals), {"from": admin})
    vaultBalanceBefore = underlying.balanceOf(bob)
    tx = strategy.withdraw(scale(5, underlyingDecimals), {"from": bob})
    vaultBalanceAfter = underlying.balanceOf(bob)
    assert tx.return_value == True
    assert vaultBalanceAfter - vaultBalanceBefore == scale(5, underlyingDecimals)
    crvRewards = interface.IRewardStaking(strategy.rewards())
    depositedBalance = crvRewards.balanceOf(strategy)
    assert depositedBalance < scale(4, decimals)
    assert depositedBalance > scale(2, decimals)


@pytest.mark.mainnetFork
def test_withdraw_all_with_idle_balance(
    strategy, underlying, admin, bob, underlyingDecimals, role_manager
):
    role_manager.addGovernor(bob, {"from": admin})
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    vaultBalanceBefore = underlying.balanceOf(bob)
    tx = strategy.withdrawAll({"from": bob})
    vaultBalanceAfter = underlying.balanceOf(bob)
    assert tx.events["WithdrawAll"]["amount"] == vaultBalanceAfter - vaultBalanceBefore
    assert tx.return_value > scale(9, underlyingDecimals)
    assert vaultBalanceAfter - vaultBalanceBefore > scale(9, underlyingDecimals)
    assert underlying.balanceOf(strategy) == 0


@pytest.mark.mainnetFork
def test_withdraw_all_with_all_deposited(
    strategy, underlying, admin, bob, interface, underlyingDecimals, role_manager
):
    role_manager.addGovernor(bob, {"from": admin})
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    strategy.deposit({"from": bob, "value": 0})
    vaultBalanceBefore = underlying.balanceOf(bob)
    tx = strategy.withdrawAll({"from": bob})
    vaultBalanceAfter = underlying.balanceOf(bob)
    assert tx.return_value > scale(9, underlyingDecimals)
    assert vaultBalanceAfter - vaultBalanceBefore > scale(9, underlyingDecimals)
    crvRewards = interface.IRewardStaking(strategy.rewards())
    assert crvRewards.balanceOf(strategy) == 0


@pytest.mark.mainnetFork
def test_withdraw_all_with_some_deposited(
    strategy, underlying, admin, bob, interface, underlyingDecimals, role_manager
):
    role_manager.addGovernor(bob, {"from": admin})
    underlying.transfer(strategy, scale(4, underlyingDecimals), {"from": admin})
    strategy.deposit({"from": bob, "value": 0})
    underlying.transfer(strategy, scale(4, underlyingDecimals), {"from": admin})
    vaultBalanceBefore = underlying.balanceOf(bob)
    tx = strategy.withdrawAll({"from": bob})
    vaultBalanceAfter = underlying.balanceOf(bob)
    assert tx.return_value > scale(6, underlyingDecimals)
    assert vaultBalanceAfter - vaultBalanceBefore > scale(7, underlyingDecimals)
    crvRewards = interface.IRewardStaking(strategy.rewards())
    assert crvRewards.balanceOf(strategy) == 0


@pytest.mark.mainnetFork
def test_harvest_cvx(
    strategy, admin, underlying, bob, cvx, decimals, underlyingDecimals
):
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    strategy.deposit({"from": bob, "value": 0})
    cvx.transfer(strategy, scale(10, decimals), {"from": admin})
    tx = strategy.harvest({"from": bob})
    assert tx.events["Harvest"]["amount"] > 0
    assert strategy.balance() > scale(10, underlyingDecimals)
    assert tx.return_value > 0


@pytest.mark.mainnetFork
def test_harvest_crv(
    strategy, admin, underlying, crv, bob, decimals, underlyingDecimals
):
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    strategy.deposit({"from": bob, "value": 0})
    crv.transfer(strategy, scale(10, decimals), {"from": admin})
    tx = strategy.harvest({"from": bob})
    assert strategy.balance() > scale(10, underlyingDecimals)
    assert tx.return_value > 0


@pytest.mark.mainnetFork
def test_harvest_rewards(
    strategy, admin, underlying, bob, chain, interface, underlyingDecimals
):
    # Depositing
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    strategy.deposit({"from": bob, "value": 0})

    # Generating Rewards
    chain.sleep(3 * 86400)

    # Harvesting
    balanceBefore = strategy.balance()
    tx = strategy.harvest({"from": bob})
    rewards = interface.IRewardBase(strategy.rewards())
    if rewards.periodFinish() > chain.time():
        assert strategy.balance() > balanceBefore
        assert tx.return_value > 0


@pytest.mark.mainnetFork
def test_harvestable(
    strategy,
    admin,
    underlying,
    bob,
    chain,
    interface,
    underlyingDecimals,
    address_provider,
    BkdTriHopCvx,
    alice,
    strategy_params
):
    # Depositing
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    strategy.deposit({"from": bob, "value": 0})

    # depositing from second strategy
    # this is used so we can trigger a claim reward to refresh the Convex Rewards `earned()` calc
    second_strategy = admin.deploy(
        BkdTriHopCvx,
        bob,
        alice,
        strategy_params[0],
        strategy_params[1],
        strategy_params[2],
        strategy_params[3],
        strategy_params[4],
        address_provider
    )
    second_strategy.setImbalanceToleranceOut(scale("0.3"), {"from": admin})
    underlying.transfer(second_strategy, scale(10, underlyingDecimals), {"from": admin})
    second_strategy.deposit({"from": bob, "value": 0})
    second_strategy.withdraw(scale(5, underlyingDecimals), {"from": bob})

    # Generating rewards to harvest
    chain.sleep(3 * 86400)

    # update `earned()` calc by harvesting from second strategy
    second_strategy.harvest({"from": bob})

    # Harvestable
    harvestable = strategy.harvestable()

    # Harvesting
    balanceBefore = strategy.balance()
    tx = strategy.harvest({"from": bob})
    difference = abs(tx.return_value - harvestable)
    rewards = interface.IRewardBase(strategy.rewards())
    if rewards.periodFinish() > chain.time():
        assert strategy.balance() > balanceBefore
        assert tx.return_value > 0
        assert difference / max(tx.return_value, harvestable) < 0.3
        assert harvestable > 0


@pytest.mark.mainnetFork
def test_harvestable_reward_tokens(
    strategy,
    admin,
    underlying,
    bob,
    chain,
    interface,
    underlyingDecimals,
    address_provider,
    BkdTriHopCvx,
    alice,
    strategy_params
):
    # Adding Reward Tokens
    strategy.addRewardToken(TokenAddresses.SPELL, {"from": admin})

    # Depositing
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    strategy.deposit({"from": bob, "value": 0})

    # depositing from second strategy
    # this is used so we can trigger a claim reward to refresh the Convex Rewards `earned()` calc
    second_strategy = admin.deploy(
        BkdTriHopCvx,
        bob,
        alice,
        strategy_params[0],
        strategy_params[1],
        strategy_params[2],
        strategy_params[3],
        strategy_params[4],
        address_provider
    )
    second_strategy.setImbalanceToleranceOut(scale("0.3"), {"from": admin})
    underlying.transfer(second_strategy, scale(10, underlyingDecimals), {"from": admin})
    second_strategy.deposit({"from": bob, "value": 0})
    second_strategy.withdraw(scale(5, underlyingDecimals), {"from": bob})

    # Generating rewards to harvest
    chain.sleep(3 * 86400)

    # update `earned()` calc by harvesting from second strategy
    second_strategy.harvest({"from": bob})

    # Harvestable
    harvestable = strategy.harvestable()

    # Harvesting
    balanceBefore = strategy.balance()
    tx = strategy.harvest({"from": bob})
    difference = abs(tx.return_value - harvestable)
    rewards = interface.IRewardBase(strategy.rewards())
    if rewards.periodFinish() > chain.time():
        assert strategy.balance() > balanceBefore
        assert tx.return_value > 0
        assert difference / max(tx.return_value, harvestable) < 0.3
        assert harvestable > 0


@pytest.mark.mainnetFork
def test_harvest_gov_share(
    strategy, admin, underlying, bob, charlie, crv, cvx, decimals, underlyingDecimals
):
    # Depositing
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    strategy.deposit({"from": bob, "value": 0})

    # Adding CVX & CRV
    cvx.transfer(strategy, scale(10, decimals), {"from": admin})
    crv.transfer(strategy, scale(10, decimals), {"from": admin})

    # Setting up reserve
    tx = strategy.setCommunityReserve(charlie, {"from": admin})
    assert tx.events["SetCommunityReserve"]["reserve"] == charlie
    tx = strategy.setCrvCommunityReserveShare(scale(0.5, decimals), {"from": admin})
    assert tx.events["SetCrvCommunityReserveShare"]["value"] == scale(0.5, decimals)
    tx = strategy.setCvxCommunityReserveShare(scale(0.2, decimals), {"from": admin})
    assert tx.events["SetCvxCommunityReserveShare"]["value"] == scale(0.2, decimals)

    # Harvesting
    cvxBalanceBefore = cvx.balanceOf(charlie)
    crvBalanceBefore = crv.balanceOf(charlie)
    strategy.harvest({"from": bob})
    reserveCvx = cvx.balanceOf(charlie) - cvxBalanceBefore
    reserveCrv = crv.balanceOf(charlie) - crvBalanceBefore
    assert reserveCvx > 0
    assert reserveCrv > 0
    assert pytest.approx(reserveCvx) == scale(2, decimals)
    assert pytest.approx(reserveCrv) == scale(5, decimals)


@pytest.mark.mainnetFork
def test_has_pending_funds(strategy):
    assert strategy.hasPendingFunds() == False


@pytest.mark.mainnetFork
def test_returns_false_adding_already_added_reward_token(strategy, admin, sushi):
    tx = strategy.addRewardToken(sushi, {"from": admin})
    assert tx.events["AddRewardToken"]["token"] == sushi
    assert tx.return_value == True
    tx = strategy.addRewardToken(sushi, {"from": admin})
    assert tx.return_value == False


@pytest.mark.mainnetFork
def test_harvesting_reward_token(
    strategy, admin, sushi, underlying, decimals, bob, underlyingDecimals
):
    strategy.addRewardToken(sushi, {"from": admin})
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    strategy.deposit({"from": bob, "value": 0})
    sushi.transfer(strategy, scale(10, decimals), {"from": admin})
    assert sushi.balanceOf(strategy) == scale(10, decimals)
    tx = strategy.harvest({"from": bob})
    assert strategy.balance() > scale(10, underlyingDecimals)
    assert tx.return_value > 0
    assert sushi.balanceOf(strategy) == 0


@pytest.mark.mainnetFork
def test_removing_reward_token_that_doesnt_exist(strategy, admin, sushi):
    tx = strategy.removeRewardToken(sushi, {"from": admin})
    assert tx.return_value == False


@pytest.mark.mainnetFork
def test_removing_reward_token(strategy, admin, sushi):
    strategy.addRewardToken(sushi, {"from": admin})
    tx = strategy.removeRewardToken(sushi, {"from": admin})
    assert tx.events["RemoveRewardToken"]["token"] == sushi


@pytest.mark.mainnetFork
def test_change_convex_pool(
    strategy, admin, interface, chain, bob, underlying, underlyingDecimals
):
    # Test depositing
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    balance = strategy.balance()
    assert balance == scale(10, underlyingDecimals)
    tx = strategy.deposit({"from": bob, "value": 0})
    assert tx.return_value == True
    assert strategy.balance() > scale(9, underlyingDecimals)
    assert strategy.balance() < scale(11, underlyingDecimals)
    crvRewards = interface.IRewardStaking(strategy.rewards())
    assert crvRewards.balanceOf(strategy) > scale(9)

    # Generating Rewards
    chain.sleep(3 * 86400)

    # Test harvesting
    balanceBefore = strategy.balance()
    tx = strategy.harvest({"from": bob})
    rewards = interface.IRewardBase(strategy.rewards())
    if rewards.periodFinish() > chain.time():
        assert strategy.balance() > balanceBefore
        assert tx.return_value > 0

    # Test withdrawing
    vaultBalanceBefore = underlying.balanceOf(bob)
    tx = strategy.withdraw(scale(5, underlyingDecimals), {"from": bob})
    assert get_first_event(tx, "Withdraw")["amount"] == scale(5, underlyingDecimals)
    assert tx.return_value == True
    assert underlying.balanceOf(bob) - vaultBalanceBefore == scale(
        5, underlyingDecimals
    )
    crvRewards = interface.IRewardStaking(strategy.rewards())
    depositedBalance = crvRewards.balanceOf(strategy)
    assert depositedBalance < scale(6)
    assert depositedBalance > scale(4)

    # Generating Rewards
    chain.sleep(3 * 86400)

    # Changing Convex Pool
    strategy.setImbalanceToleranceIn(scale("0.2"), {"from": admin})
    strategy.setImbalanceToleranceOut(scale("0.2"), {"from": admin})
    strategy.setHopImbalanceToleranceIn(scale("0.2"), {"from": admin})
    strategy.setHopImbalanceToleranceOut(scale("0.2"), {"from": admin})
    strategy.changeConvexPool(32, "0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B", 1, {"from": admin})

    # Test depositing
    balanceBefore = strategy.balance()
    underlying.transfer(strategy, scale(10, underlyingDecimals), {"from": admin})
    assert strategy.balance() - balanceBefore == scale(10, underlyingDecimals)
    tx = strategy.deposit({"from": bob, "value": 0})
    assert tx.return_value == True
    assert strategy.balance() > scale(9, underlyingDecimals)
    crvRewards = interface.IRewardStaking(strategy.rewards())
    assert crvRewards.balanceOf(strategy) > scale(9)

    # Generating Rewards
    chain.sleep(3 * 86400)

    # Test harvesting
    balanceBefore = strategy.balance()
    tx = strategy.harvest({"from": bob})
    rewards = interface.IRewardBase(strategy.rewards())
    if rewards.periodFinish() > chain.time():
        assert strategy.balance() > balanceBefore
        assert tx.return_value > 0

    # Test withdrawing
    vaultBalanceBefore = underlying.balanceOf(bob)
    tx = strategy.withdraw(scale(5, underlyingDecimals), {"from": bob})
    assert get_first_event(tx, "Withdraw")["amount"] == scale(5, underlyingDecimals)
    assert tx.return_value == True
    assert underlying.balanceOf(bob) - vaultBalanceBefore == scale(
        5, underlyingDecimals
    )
    crvRewards = interface.IRewardStaking(strategy.rewards())
    depositedBalance = crvRewards.balanceOf(strategy)
    assert depositedBalance < scale(20)
    assert depositedBalance > scale(4)


@pytest.mark.mainnetFork
def test_reward_tokens_view(strategy, sushi, admin):
    rewardTokensBefore = strategy.rewardTokens()
    assert len(rewardTokensBefore) == 0
    strategy.addRewardToken(sushi, {"from": admin})
    rewardTokensAfter = strategy.rewardTokens()
    assert len(rewardTokensAfter) == 1
    assert rewardTokensAfter[0] == sushi


@pytest.mark.mainnetFork
def test_reverts_for_invalid_curve_pool(strategy, sushi, admin):
    with reverts():
        strategy.changeConvexPool(32, sushi, 1, {"from": admin})
