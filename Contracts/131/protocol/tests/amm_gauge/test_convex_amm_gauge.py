import brownie
import pytest

from support.constants import ADMIN_DELAY


TEST_DELAY = 2 * 86400


@pytest.fixture
def setup_amm_gauge(
    inflation_manager,
    minter,
    ammConvexGauge,
    mockAmmToken,
    admin,
    chain,
    bkdToken,
):
    inflation_manager.setAmmGauge(mockAmmToken, ammConvexGauge, {"from": admin})
    inflation_manager.prepareAmmTokenWeight(mockAmmToken, 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeAmmTokenWeight(mockAmmToken, {"from": admin})
    inflation_manager.setMinter(minter, {"from": admin})


@pytest.mark.mainnetFork
@pytest.mark.usefixtures("setup_amm_gauge")
def test_single_amm_staking_correctly_updates_total_integral_and_rewards(
    minter, ammConvexGauge, mockAmmToken, alice, chain
):
    mockAmmToken.mint(alice, 4e18)
    mockAmmToken.approve(ammConvexGauge, 4e18, {"from": alice})

    start_time = ammConvexGauge.ammLastUpdated()
    ammConvexGauge.stake(4e18, {"from": alice})
    assert ammConvexGauge.totalStaked() == 4e18

    chain.sleep(TEST_DELAY)
    ammConvexGauge.poolCheckpoint()

    end_time = chain[-1]["timestamp"]

    expected = minter.getAmmInflationRate() * (end_time - start_time)
    assert pytest.approx(ammConvexGauge.ammStakedIntegral(), abs=1e18) == expected / 4

    predicted = ammConvexGauge.claimableRewards(alice)
    tx = ammConvexGauge.claimRewards(alice, {"from": alice})

    assert tx.events["TokensMinted"][0]["beneficiary"] == alice
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=5e18) == predicted
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=5e18) == expected


@pytest.mark.mainnetFork
@pytest.mark.usefixtures("setup_amm_gauge")
def test_two_amm_staking_correctly_updates_total_integral_and_rewards(
    minter, ammConvexGauge, mockAmmToken, alice, bob, chain, mockRewardStaking
):
    mockAmmToken.mint(alice, 4e18)
    mockAmmToken.approve(ammConvexGauge, 4e18, {"from": alice})

    mockAmmToken.mint(bob, 2e18)
    mockAmmToken.approve(ammConvexGauge, 2e18, {"from": bob})

    ammConvexGauge.stake(4e18, {"from": alice})
    start_time = ammConvexGauge.ammLastUpdated()
    assert ammConvexGauge.totalStaked() == 4e18

    chain.sleep(TEST_DELAY)

    chain.mine()
    mockRewardStaking.setCrvEarned(ammConvexGauge, 10e18)
    bob_time = chain[-1]["timestamp"]

    ammConvexGauge.stake(2e18, {"from": bob})
    assert ammConvexGauge.totalStaked() == 6e18

    chain.sleep(TEST_DELAY)

    chain.mine()
    mockRewardStaking.setCrvEarned(ammConvexGauge, 10e18)

    end_time = chain[-1]["timestamp"]
    inflation_rate = minter.getAmmInflationRate()

    expected_alice = inflation_rate * (bob_time - start_time) + inflation_rate * (
        4 / 6
    ) * (end_time - bob_time)

    bob_expected = inflation_rate * 2 / 6 * (end_time - bob_time)

    expected_crv_alice = 10e18 + 4 / 6 * 10e18
    expected_crv_bob = 10e18 * 2 / 6

    chain.mine()
    predicted_alice = ammConvexGauge.claimableRewards(alice)
    all_predicted_alice = ammConvexGauge.allClaimableRewards(alice)
    tx = ammConvexGauge.claimRewards(alice, {"from": alice})

    # Check predicted values
    assert pytest.approx(all_predicted_alice[0], abs=1e18) == expected_alice
    assert pytest.approx(all_predicted_alice[0], abs=1e18) == predicted_alice
    assert pytest.approx(all_predicted_alice[1], abs=1e18) == expected_crv_alice
    assert pytest.approx(
        all_predicted_alice[2], abs=1e18
    ) == ammConvexGauge.getCvxMintAmount(expected_crv_alice)

    # Check actual values
    assert tx.events["TokensMinted"][0]["beneficiary"] == alice
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert (
        pytest.approx(tx.events["RewardClaimed"][0]["bkdAmount"], abs=3e18)
        == expected_alice
    )
    assert (
        pytest.approx(tx.events["RewardClaimed"][0]["crvAmount"], abs=3e18)
        == expected_crv_alice
    )
    assert pytest.approx(
        tx.events["RewardClaimed"][0]["cvxAmount"], abs=3e18
    ) == ammConvexGauge.getCvxMintAmount(expected_crv_alice)

    predicted_bob = ammConvexGauge.claimableRewards(bob)
    all_predicted_bob = ammConvexGauge.allClaimableRewards(bob)
    tx = ammConvexGauge.claimRewards(bob, {"from": bob})

    # Check predicted values
    assert pytest.approx(all_predicted_bob[0], abs=1e18) == bob_expected
    assert pytest.approx(all_predicted_bob[0], abs=1e18) == predicted_bob
    assert pytest.approx(all_predicted_bob[1], abs=1e18) == expected_crv_bob
    assert pytest.approx(
        all_predicted_bob[2], abs=1e18
    ) == ammConvexGauge.getCvxMintAmount(expected_crv_bob)

    assert tx.events["TokensMinted"][0]["beneficiary"] == bob
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert (
        pytest.approx(tx.events["RewardClaimed"][0]["bkdAmount"], abs=3e18)
        == bob_expected
    )
    assert (
        pytest.approx(tx.events["RewardClaimed"][0]["crvAmount"], abs=3e18)
        == expected_crv_bob
    )
    assert pytest.approx(
        tx.events["RewardClaimed"][0]["cvxAmount"], abs=3e18
    ) == ammConvexGauge.getCvxMintAmount(expected_crv_bob)


@pytest.mark.mainnetFork
@pytest.mark.usefixtures("setup_amm_gauge")
def test_single_amm_staking_claimable_computation_is_correct(
    minter, ammConvexGauge, mockAmmToken, alice, chain, mockRewardStaking
):
    mockAmmToken.mint(alice, 4e18)
    mockAmmToken.approve(ammConvexGauge, 4e18, {"from": alice})

    start_time = ammConvexGauge.ammLastUpdated()
    ammConvexGauge.stake(4e18, {"from": alice})
    assert ammConvexGauge.totalStaked() == 4e18

    chain.sleep(TEST_DELAY)
    mockRewardStaking.setCrvEarned(ammConvexGauge, 20e18)

    ammConvexGauge.poolCheckpoint()

    end_time = chain[-1]["timestamp"]

    expected = minter.getAmmInflationRate() * (end_time - start_time)
    assert pytest.approx(ammConvexGauge.ammStakedIntegral(), abs=1e18) == expected / 4
    assert pytest.approx(ammConvexGauge.crvStakedIntegral(), abs=1e18) == 20e18 / 4

    predicted = ammConvexGauge.claimableRewards(alice)
    predicted_all = ammConvexGauge.allClaimableRewards(alice)
    assert pytest.approx(predicted_all[0], abs=5e18) == expected
    assert predicted_all[1] == 20e18
    assert predicted_all[2] == ammConvexGauge.getCvxMintAmount(20e18)

    tx = ammConvexGauge.claimRewards(alice, {"from": alice})

    assert tx.events["TokensMinted"][0]["beneficiary"] == alice
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=5e18) == predicted
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=5e18) == expected


@pytest.mark.mainnetFork
@pytest.mark.usefixtures("setup_amm_gauge")
def test_amm_staking_with_inflation_recipient_computes_correctly(
    minter,
    ammConvexGauge,
    mockAmmToken,
    alice,
    bob,
    admin,
    chain,
    mockRewardStaking,
):
    mockAmmToken.mint(alice, 4e18)
    mockAmmToken.approve(ammConvexGauge, 4e18, {"from": alice})

    start_time = ammConvexGauge.ammLastUpdated()
    ammConvexGauge.stake(4e18, {"from": alice})
    assert ammConvexGauge.totalStaked() == 4e18

    chain.sleep(TEST_DELAY)
    mockRewardStaking.setCrvEarned(ammConvexGauge, 20e18)

    ammConvexGauge.setInflationRecipient(bob, {"from": admin})
    end_time = chain[-1]["timestamp"]

    expected = minter.getAmmInflationRate() * (end_time - start_time)
    assert pytest.approx(ammConvexGauge.ammStakedIntegral(), abs=1e18) == expected / 4
    assert pytest.approx(ammConvexGauge.crvStakedIntegral(), abs=1e18) == 20e18 / 4

    # Claimable to alice just after setting inflation recipient
    predicted_all = ammConvexGauge.allClaimableRewards(alice)
    assert pytest.approx(predicted_all[0], abs=5e18) == expected
    assert predicted_all[1] == 20e18
    assert predicted_all[2] == ammConvexGauge.getCvxMintAmount(20e18)

    chain.sleep(TEST_DELAY)
    mockRewardStaking.setCrvEarned(ammConvexGauge, 20e18)
    end_time_recipient = chain[-1]["timestamp"]

    # Claimable to alice after a while (only CRV and CVX should go up)
    predicted_all = ammConvexGauge.allClaimableRewards(alice)
    assert pytest.approx(predicted_all[0], abs=5e18) == expected
    assert predicted_all[1] == 40e18
    assert predicted_all[2] == ammConvexGauge.getCvxMintAmount(40e18)

    # Inflation recipient should only get the bkd inflation
    expected_recipient = minter.getAmmInflationRate() * (end_time_recipient - end_time)
    predicted_all = ammConvexGauge.allClaimableRewards(bob)
    assert pytest.approx(predicted_all[0], abs=5e18) == expected_recipient
    assert predicted_all[1] == 0
    assert predicted_all[2] == 0

    tx = ammConvexGauge.claimRewards(alice, {"from": alice})
    assert tx.events["RewardClaimed"][0]["beneficiary"] == alice
    assert (
        pytest.approx(tx.events["RewardClaimed"][0]["bkdAmount"], abs=5e18) == expected
    )
    assert pytest.approx(tx.events["RewardClaimed"][0]["crvAmount"], abs=1e18) == 40e18
    assert pytest.approx(
        tx.events["RewardClaimed"][0]["cvxAmount"], abs=1e18
    ) == ammConvexGauge.getCvxMintAmount(40e18)

    tx = ammConvexGauge.claimRewards(bob, {"from": bob})
    assert tx.events["RewardClaimed"][0]["beneficiary"] == bob
    assert (
        pytest.approx(tx.events["RewardClaimed"][0]["bkdAmount"], abs=5e18)
        == expected_recipient
    )
    assert tx.events["RewardClaimed"][0]["crvAmount"] == 0
    assert tx.events["RewardClaimed"][0]["cvxAmount"] == 0

    ammConvexGauge.deactivateInflationRecipient({"from": admin})

    start_time = chain[-1]["timestamp"]
    chain.sleep(TEST_DELAY)
    chain.mine()
    end_time = chain[-1]["timestamp"]

    expected = minter.getAmmInflationRate() * (end_time - start_time)
    predicted_all = ammConvexGauge.allClaimableRewards(alice)
    assert pytest.approx(predicted_all[0], abs=5e18) == expected

    predicted_all = ammConvexGauge.allClaimableRewards(bob)
    assert pytest.approx(predicted_all[0], abs=5e18) == 0


@pytest.mark.mainnetFork
@pytest.mark.usefixtures("setup_amm_gauge")
def test_claming_for_gauge_does_not_break_calculation(
    minter,
    ammConvexGauge,
    mockAmmToken,
    alice,
    chain,
    mockRewardStaking,
):
    mockAmmToken.mint(alice, 4e18)
    mockAmmToken.approve(ammConvexGauge, 4e18, {"from": alice})

    start_time = ammConvexGauge.ammLastUpdated()
    ammConvexGauge.stake(4e18, {"from": alice})
    assert ammConvexGauge.totalStaked() == 4e18

    chain.sleep(TEST_DELAY)
    mockRewardStaking.setCrvEarned(ammConvexGauge, 20e18)
    ammConvexGauge.poolCheckpoint()

    end_time = chain[-1]["timestamp"]

    expected = minter.getAmmInflationRate() * (end_time - start_time)
    assert pytest.approx(ammConvexGauge.ammStakedIntegral(), abs=1e18) == expected / 4
    assert pytest.approx(ammConvexGauge.crvStakedIntegral(), abs=1e18) == 20e18 / 4

    # Claimable to alice just after setting inflation recipient
    predicted_all = ammConvexGauge.allClaimableRewards(alice)
    assert pytest.approx(predicted_all[0], abs=5e18) == expected
    assert predicted_all[1] == 20e18
    assert predicted_all[2] == ammConvexGauge.getCvxMintAmount(20e18)

    mockRewardStaking.getReward(ammConvexGauge, True)

    chain.sleep(TEST_DELAY)
    mockRewardStaking.setCrvEarned(ammConvexGauge, 20e18)
    end_time = chain[-1]["timestamp"]
    expected = minter.getAmmInflationRate() * (end_time - start_time)

    # Claimable to alice after a while (only CRV and CVX should go up)
    predicted_all = ammConvexGauge.allClaimableRewards(alice)
    assert pytest.approx(predicted_all[0], abs=5e18) == expected
    assert predicted_all[1] == 40e18
    assert predicted_all[2] == ammConvexGauge.getCvxMintAmount(40e18)

    tx = ammConvexGauge.claimRewards(alice, {"from": alice})
    assert tx.events["RewardClaimed"][0]["beneficiary"] == alice
    assert (
        pytest.approx(tx.events["RewardClaimed"][0]["bkdAmount"], abs=5e18) == expected
    )
    assert pytest.approx(tx.events["RewardClaimed"][0]["crvAmount"], abs=1e18) == 40e18
    assert pytest.approx(
        tx.events["RewardClaimed"][0]["cvxAmount"], abs=1e18
    ) == ammConvexGauge.getCvxMintAmount(40e18)


@pytest.mark.mainnetFork
@pytest.mark.usefixtures("setup_amm_gauge")
def test_sending_crv_to_gauge_does_not_inflate_cvx_amount(
    minter,
    ammConvexGauge,
    mockAmmToken,
    alice,
    bob,
    chain,
    mockRewardStaking,
    mockCurveToken,
):
    mockAmmToken.mint(alice, 4e18)
    mockAmmToken.approve(ammConvexGauge, 4e18, {"from": alice})

    start_time = ammConvexGauge.ammLastUpdated()
    ammConvexGauge.stake(4e18, {"from": alice})
    assert ammConvexGauge.totalStaked() == 4e18

    chain.sleep(TEST_DELAY)
    mockRewardStaking.setCrvEarned(ammConvexGauge, 20e18)

    mockCurveToken.mint_for_testing(ammConvexGauge, 10e18)
    # mockCurveToken.transferFrom(bob, ammConvexGauge, 10e18, {"from": bob})

    ammConvexGauge.poolCheckpoint()

    end_time = chain[-1]["timestamp"]

    expected = minter.getAmmInflationRate() * (end_time - start_time)
    assert pytest.approx(ammConvexGauge.ammStakedIntegral(), abs=1e18) == expected / 4
    assert pytest.approx(ammConvexGauge.crvStakedIntegral(), abs=1e18) == 30e18 / 4

    predicted = ammConvexGauge.claimableRewards(alice)
    predicted_all = ammConvexGauge.allClaimableRewards(alice)
    should_cvx = ammConvexGauge.getCvxMintAmount(20e18)
    assert pytest.approx(predicted_all[0], abs=5e18) == expected
    assert predicted_all[1] == 30e18
    assert predicted_all[2] == should_cvx

    tx = ammConvexGauge.claimRewards(alice, {"from": alice})

    assert tx.events["RewardClaimed"][0]["beneficiary"] == alice
    assert pytest.approx(tx.events["RewardClaimed"][0]["bkdAmount"]) == tx.return_value
    assert (
        pytest.approx(tx.events["RewardClaimed"][0]["bkdAmount"], abs=5e18) == predicted
    )
    assert (
        pytest.approx(tx.events["RewardClaimed"][0]["bkdAmount"], abs=5e18) == expected
    )
    assert pytest.approx(tx.events["RewardClaimed"][0]["crvAmount"], abs=5e18) == 30e18
    assert (
        pytest.approx(tx.events["RewardClaimed"][0]["cvxAmount"], abs=5e18)
        == should_cvx
    )
