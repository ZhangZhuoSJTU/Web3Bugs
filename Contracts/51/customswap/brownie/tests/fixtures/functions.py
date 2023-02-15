import pytest


@pytest.fixture(scope="module")
def get_admin_balances(swap, coins):
    def _get_admin_balances():
        admin_balances = []
        for i, coin in enumerate(coins):
            admin_balances.append(swap.getAdminBalance(i))

        return admin_balances

    return _get_admin_balances


@pytest.fixture(scope="session")
def approx():
    def _approx(a, b, precision=1e-10):
        return 2 * abs(a - b) / (a + b) <= precision

    return _approx
