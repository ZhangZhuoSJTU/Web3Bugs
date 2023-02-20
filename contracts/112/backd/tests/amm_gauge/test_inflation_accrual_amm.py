import brownie
import pytest

from brownie import ZERO_ADDRESS, reverts
from support.constants import ADMIN_DELAY, Roles


TEST_DELAY = 2 * 86400


@pytest.fixture
def setup_amm_gauge(
    inflation_manager, minter, ammGauge, mockAmmToken, admin, chain, bkdToken
):
    inflation_manager.setAmmGauge(mockAmmToken, ammGauge, {"from": admin})
    inflation_manager.prepareAmmTokenWeight(mockAmmToken, 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeAmmTokenWeight(mockAmmToken, {"from": admin})
    inflation_manager.setMinter(minter, {"from": admin})


@pytest.mark.usefixtures("setup_amm_gauge")
def test_single_amm_staking_correctly_updates_total_integral_and_rewards(
    minter, ammGauge, mockAmmToken, alice, chain
):
    mockAmmToken.mint(alice, 4e18)
    mockAmmToken.approve(ammGauge, 4e18, {"from": alice})

    start_time = ammGauge.ammLastUpdated()
    ammGauge.stake(4e18, {"from": alice})
    assert ammGauge.totalStaked() == 4e18

    chain.sleep(TEST_DELAY)
    ammGauge.poolCheckpoint()

    end_time = chain[-1]["timestamp"]

    expected = minter.getAmmInflationRate() * (end_time - start_time)
    assert pytest.approx(ammGauge.ammStakedIntegral(), abs=1e18) == expected / 4

    predicted = ammGauge.claimableRewards(alice)
    tx = ammGauge.claimRewards(alice, {"from": alice})

    assert tx.events["TokensMinted"][0]["beneficiary"] == alice
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=5e18) == predicted
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=5e18) == expected


@pytest.mark.usefixtures("setup_amm_gauge")
def test_two_amm_staking_correctly_updates_total_integral_and_rewards(
    minter, ammGauge, mockAmmToken, alice, bob, chain
):
    mockAmmToken.mint(alice, 4e18)
    mockAmmToken.approve(ammGauge, 4e18, {"from": alice})

    mockAmmToken.mint(bob, 2e18)
    mockAmmToken.approve(ammGauge, 2e18, {"from": bob})

    ammGauge.stake(4e18, {"from": alice})
    start_time = ammGauge.ammLastUpdated()
    assert ammGauge.totalStaked() == 4e18

    chain.sleep(TEST_DELAY)

    chain.mine()
    bob_time = chain[-1]["timestamp"]

    ammGauge.stake(2e18, {"from": bob})
    assert ammGauge.totalStaked() == 6e18

    chain.sleep(TEST_DELAY)

    chain.mine()
    end_time = chain[-1]["timestamp"]
    inflation_rate = minter.getAmmInflationRate()
    expected_alice = inflation_rate * (bob_time - start_time) + inflation_rate * (
        4 / 6
    ) * (end_time - bob_time)
    bob_expected = inflation_rate * 2 / 6 * (end_time - bob_time)

    chain.mine()
    predicted_alice = ammGauge.claimableRewards(alice)
    tx = ammGauge.claimRewards(alice, {"from": alice})

    assert tx.events["TokensMinted"][0]["beneficiary"] == alice
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert (
        pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=3e18)
        == predicted_alice
    )
    assert (
        pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=3e18)
        == expected_alice
    )

    predicted_bob = ammGauge.claimableRewards(bob)
    tx = ammGauge.claimRewards(bob, {"from": bob})
    assert tx.events["TokensMinted"][0]["beneficiary"] == bob
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert (
        pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=3e18) == predicted_bob
    )
    assert (
        pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=3e18) == bob_expected
    )


@pytest.mark.usefixtures("setup_amm_gauge")
def test_claiming_works_after_kill(
    inflation_manager, minter, ammGauge, mockAmmToken, admin, alice, bob, chain
):
    mockAmmToken.mint(alice, 4e18)
    mockAmmToken.approve(ammGauge, 4e18, {"from": alice})

    mockAmmToken.mint(bob, 2e18)
    mockAmmToken.approve(ammGauge, 2e18, {"from": bob})

    chain.mine()
    start_time = ammGauge.ammLastUpdated()
    ammGauge.stake(4e18, {"from": alice})
    assert ammGauge.totalStaked() == 4e18

    chain.sleep(TEST_DELAY)

    chain.mine()
    bob_time = chain[-1]["timestamp"]

    ammGauge.stake(2e18, {"from": bob})
    assert ammGauge.totalStaked() == 6e18

    chain.sleep(TEST_DELAY)

    chain.mine()
    end_time = chain[-1]["timestamp"]
    inflation_rate = minter.getAmmInflationRate()
    expected_alice = inflation_rate * (
        bob_time - start_time
    ) + inflation_rate * 4 / 6 * (end_time - bob_time)
    bob_expected = inflation_rate * 2 / 6 * (end_time - bob_time)

    tx = inflation_manager.removeAmmGauge(mockAmmToken, {"from": admin})
    assert tx.events["AmmGaugeDelisted"][0]["token"] == mockAmmToken
    assert tx.events["AmmGaugeDelisted"][0]["ammGauge"] == ammGauge

    chain.mine()
    predicted_alice = ammGauge.claimableRewards(alice)
    tx = ammGauge.claimRewards(alice, {"from": alice})

    assert tx.events["TokensMinted"][0]["beneficiary"] == alice
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert (
        pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=3e18)
        == predicted_alice
    )
    assert (
        pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=3e18)
        == expected_alice
    )

    chain.mine()
    predicted_bob = ammGauge.claimableRewards(bob)
    tx = ammGauge.claimRewards(bob, {"from": bob})
    assert tx.events["TokensMinted"][0]["beneficiary"] == bob
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert (
        pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=3e18) == predicted_bob
    )
    assert (
        pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=3e18) == bob_expected
    )


@pytest.mark.usefixtures("setup_amm_gauge")
def test_zero_staked_phases_do_not_accrue_inflation(
    minter, ammGauge, mockAmmToken, alice, chain
):
    mockAmmToken.mint(alice, 4e18)
    mockAmmToken.approve(ammGauge, 4e18, {"from": alice})

    chain.sleep(TEST_DELAY)
    assert ammGauge.ammStakedIntegral() == 0
    ammGauge.poolCheckpoint()
    assert ammGauge.ammStakedIntegral() == 0
    checkpoint_time = chain[-1]["timestamp"]

    chain.mine()
    start_time = ammGauge.ammLastUpdated()
    assert start_time == checkpoint_time

    ammGauge.stake(4e18, {"from": alice})
    assert ammGauge.totalStaked() == 4e18

    chain.sleep(TEST_DELAY)

    chain.mine()
    end_time = chain[-1]["timestamp"]
    inflation_rate = minter.getAmmInflationRate()
    expected_alice = inflation_rate * (end_time - start_time)

    chain.mine()
    predicted = ammGauge.claimableRewards(alice)
    tx = ammGauge.claimRewards(alice, {"from": alice})
    assert tx.events["TokensMinted"][0]["beneficiary"] == alice
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=3e18) == predicted
    assert (
        pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=3e18)
        == expected_alice
    )


@pytest.mark.usefixtures("setup_amm_gauge")
def test_set_zap(
    ammGauge, mockAmmToken, alice, bob, chain, admin, charlie, role_manager
):
    # Should be empty by default
    assert role_manager.getRoleMemberCount(Roles.GAUGE_ZAP.value) == 0

    # Staking and generating rewards
    mockAmmToken.mint(alice, 4e18)
    mockAmmToken.approve(ammGauge, 4e18, {"from": alice})
    ammGauge.stake(4e18, {"from": alice})
    chain.sleep(TEST_DELAY)
    ammGauge.poolCheckpoint()

    # Should revert from non owner
    with reverts("unauthorized access"):
        ammGauge.claimRewards(alice, {"from": bob})

    # Should revert setting zap from non-admin
    with reverts("unauthorized access"):
        role_manager.grantRole(Roles.GAUGE_ZAP.value, charlie, {"from": bob})

    # Should set zap
    role_manager.grantRole(Roles.GAUGE_ZAP.value, charlie, {"from": admin})
    assert role_manager.getRoleMember(Roles.GAUGE_ZAP.value, 0) == charlie

    # Should be able to claim on behalf of zap
    ammGauge.claimRewards(alice, {"from": charlie})
