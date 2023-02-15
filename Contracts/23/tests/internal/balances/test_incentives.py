import pytest
from tests.constants import SECONDS_IN_YEAR, START_TIME


@pytest.mark.balances
class TestIncentives:
    @pytest.fixture(scope="module", autouse=True)
    def incentives(self, MockIncentives, accounts):
        return MockIncentives.deploy({"from": accounts[0]})

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    def test_incentives_no_supply(self, incentives, accounts):
        # This case appears when minting the initial tokens
        incentives.setNTokenParameters(1, accounts[1], 0, 100, START_TIME)

        claimed = incentives.calculateIncentivesToClaim(
            accounts[1], 1_000_000e8, START_TIME, 0, START_TIME + SECONDS_IN_YEAR
        )

        assert claimed == 0

    def test_incentives_one_year(self, incentives, accounts):
        incentives.setNTokenParameters(1, accounts[1], 150_000_000e8, 100, START_TIME)

        claimed = incentives.calculateIncentivesToClaim(
            accounts[1], 1_500_000e8, START_TIME, 0, START_TIME + SECONDS_IN_YEAR
        )

        # After 1 year, 1% of the avg supply returns 1% of the tokens minted
        assert claimed == 1e8

    def test_incentives_zero_time(self, incentives, accounts):
        incentives.setNTokenParameters(1, accounts[1], 150_000_000e8, 100, START_TIME)

        claimed = incentives.calculateIncentivesToClaim(
            accounts[1], 1_000_000e8, START_TIME, 50_000_000e8, START_TIME
        )

        assert claimed == 0

    def test_incentives_two_years(self, incentives, accounts):
        incentives.setNTokenParameters(1, accounts[1], 150_000_000e8, 100, START_TIME)

        claimed = incentives.calculateIncentivesToClaim(
            accounts[1], 1_500_000e8, START_TIME, 50_000_000e8, START_TIME + SECONDS_IN_YEAR * 2
        )

        # After 2 years, 1% of the avg supply returns 2% of the tokens minted
        assert pytest.approx(claimed, abs=1) == 2e8

    def test_incentives_three_years(self, incentives, accounts):
        incentives.setNTokenParameters(1, accounts[1], 150_000_000e8, 100, START_TIME)

        claimed = incentives.calculateIncentivesToClaim(
            accounts[1], 1_500_000e8, START_TIME, 50_000_000e8, START_TIME + SECONDS_IN_YEAR * 3
        )

        # After 3 years, 1% of the avg supply returns 3% of the tokens minted
        assert pytest.approx(claimed, abs=1) == 3e8
