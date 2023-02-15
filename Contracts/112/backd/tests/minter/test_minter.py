import brownie
import pytest


pytestmark = pytest.mark.usefixtures("setup_minter")
from support.utils import scale


@pytest.fixture
def setup_minter(
    inflation_manager, admin, mockAmmGauge, mockAmmToken, mockKeeperGauge, pool
):
    inflation_manager.setKeeperGauge(pool, mockKeeperGauge, {"from": admin})
    inflation_manager.setAmmGauge(mockAmmToken, mockAmmGauge, {"from": admin})


def test_mint_non_inflation_tokens(minter, alice, bkdToken, admin):
    tx = minter.mintNonInflationTokens(alice, 1e18, {"from": admin})

    assert tx.events["TokensMinted"][0]["beneficiary"] == alice
    assert tx.events["TokensMinted"][0]["amount"] == 1e18


def test_mint_non_inflation_tokens_subject_to_max(minter, alice, bkdToken, admin):
    with brownie.reverts("Maximum non-inflation amount exceeded."):
        tx = minter.mintNonInflationTokens(alice, 1000_000_000e18, {"from": admin})


def test_update_inflation_schedule(minter, alice, bkdToken, admin, chain):
    current_inflation_rate = minter.getLpInflationRate()
    chain.sleep(365 * 86400)
    minter.executeInflationRateUpdate()
    new_inflation_rate = minter.getLpInflationRate()
    assert pytest.approx(new_inflation_rate, abs=1e12) == 0.6 * current_inflation_rate


def test_update_inflation_schedule_multiple_periods(
    minter, alice, bkdToken, admin, chain
):
    current_inflation_rate_lp = minter.getLpInflationRate()
    current_inflation_rate_keeper = minter.getKeeperInflationRate()
    for i in range(10):
        chain.sleep(365 * 86400)
        minter.executeInflationRateUpdate()
        new_inflation_rate_lp = minter.getLpInflationRate()
        new_inflation_rate_keeper = minter.getKeeperInflationRate()
        assert (
            pytest.approx(new_inflation_rate_lp, abs=1e12)
            == minter.annualInflationDecayLp() / 1e18 * current_inflation_rate_lp
        )
        if i == 0:
            assert pytest.approx(
                new_inflation_rate_keeper, abs=1e12
            ) == minter.initialAnnualInflationRateKeeper() / (365 * 86400)
        else:
            assert (
                pytest.approx(new_inflation_rate_keeper, abs=1e12)
                == minter.annualInflationDecayKeeper()
                / 1e18
                * current_inflation_rate_keeper
            )

        current_inflation_rate_lp = new_inflation_rate_lp
        current_inflation_rate_keeper = new_inflation_rate_keeper


def test_inflation_safety_check_works(
    minter, alice, bkdToken, admin, controller, chain
):
    chain.mine()
    inflation_should = (
        chain.time() - minter.lastEvent()
    ) * minter.currentTotalInflation()

    with brownie.reverts("Mintable amount exceeded"):
        minter.mint_for_testing_with_checks(
            alice, inflation_should + 1000e18, {"from": admin}
        )
    tx = minter.mint_for_testing_with_checks(alice, inflation_should, {"from": admin})
    assert tx.events["TokensMinted"][0]["beneficiary"] == alice
    assert (
        pytest.approx(tx.events["TokensMinted"][0]["amount"], abs=1e12)
        == inflation_should
    )


def test_long_term_inflation_is_correct(minter, chain):
    current_inflation_rate_lp = minter.getLpInflationRate()
    current_inflation_rate_keeper = minter.getKeeperInflationRate()
    current_inflation_rate_amm = minter.getAmmInflationRate()
    total_tokens_minted = 0
    for i in range(80):
        chain.sleep(365 * 86400)
        # Add the total that could be minted so far to the accrued amount
        total_tokens_minted += current_inflation_rate_lp * (365 * 86400)
        total_tokens_minted += current_inflation_rate_keeper * (365 * 86400)
        total_tokens_minted += current_inflation_rate_amm * (365 * 86400)

        minter.executeInflationRateUpdate()
        current_inflation_rate_lp = minter.getLpInflationRate()
        current_inflation_rate_keeper = minter.getKeeperInflationRate()
        current_inflation_rate_amm = minter.getAmmInflationRate()

    # This is taken from the settings in deployments
    lp_initial = 60_129_542 * 1e18 * 0.7
    keeper_initial = 60_129_542 * 1e18 * 0.2
    amm_initial = 60_129_542 * 1e18 * 0.1
    lp_total = lp_initial / (1 - 0.6)
    keeper_total = keeper_initial / (1 - 0.4)
    amm_total = amm_initial / (1 - 0.4)
    # Total value of the combined annuities for the different stakeholders plus the initial period keeper / amm inflation
    expected_amount = lp_total + keeper_total + amm_total + (1_000_000 * 1e18)
    assert pytest.approx(total_tokens_minted, abs=1e20) == expected_amount
    assert pytest.approx(minter.totalAvailableToNow(), abs=1e20) == expected_amount
