import random

import brownie
import pytest
from brownie.convert.datatypes import HexString
from brownie.test import given, strategy
from tests.constants import BALANCE_FLAG, PORTFOLIO_FLAG, START_TIME
from tests.helpers import currencies_list_to_active_currency_bytes


def get_random_flags(currencyId):
    num = random.randint(1, 3)
    if num == 1:
        return (currencyId, True, True)
    elif num == 2:
        return (currencyId, True, False)
    elif num == 3:
        return (currencyId, False, True)


@pytest.mark.account_context
class TestAccountContext:
    @pytest.fixture(scope="module", autouse=True)
    def accountContext(self, MockAccountContextHandler, accounts):
        context = MockAccountContextHandler.deploy({"from": accounts[0]})
        return context

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    @given(
        length=strategy("uint", min_value=0, max_value=9),
        hasDebt=strategy("uint8", min_value=0, max_value=3),
        arrayLength=strategy("uint8"),
        bitmapId=strategy("uint16"),
    )
    def test_get_and_set_account_context(
        self, accountContext, accounts, length, hasDebt, arrayLength, bitmapId
    ):
        currencies = [get_random_flags(random.randint(1, 2 ** 14)) for i in range(0, length)]
        currenciesHex = HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")
        expectedContext = (
            START_TIME,
            HexString(hasDebt, "bytes1"),
            arrayLength,
            bitmapId,
            currenciesHex,
        )

        accountContext.setAccountContext(expectedContext, accounts[0])
        assert expectedContext == accountContext.getAccountContext(accounts[0])

    @given(length=strategy("uint", min_value=0, max_value=9))
    def test_is_active_in_balances(self, accountContext, length):
        currencies = [get_random_flags(random.randint(1, 2 ** 14)) for i in range(0, length)]
        ac = (0, "0x00", 0, 0, currencies_list_to_active_currency_bytes(currencies))

        for (c, _, balanceActive) in currencies:
            assert accountContext.isActiveInBalances(ac, c) == balanceActive

    def test_active_and_set_portfolio_flag(self, accountContext):
        # is active and in list
        currencies = [(2, True, True), (4, True, False), (512, False, True), (1024, True, False)]
        acBytes = HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")

        # is active and portfolio is set to true
        assert accountContext.setActiveCurrency(acBytes, 2, True, PORTFOLIO_FLAG, 0) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 4, True, PORTFOLIO_FLAG, 0) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 1024, True, PORTFOLIO_FLAG, 0) == acBytes
        result = accountContext.setActiveCurrency(acBytes, 512, True, PORTFOLIO_FLAG, 0)
        currencies[2] = (512, True, True)
        assert result == HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")

    def test_active_and_set_balance_flag(self, accountContext):
        currencies = [(2, True, True), (4, True, False), (512, False, True), (1024, True, False)]
        acBytes = HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")

        # is active and balance is set to true
        assert accountContext.setActiveCurrency(acBytes, 2, True, BALANCE_FLAG, 0) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 512, True, BALANCE_FLAG, 0) == acBytes

        result = accountContext.setActiveCurrency(acBytes, 4, True, BALANCE_FLAG, 0)
        currencies[1] = (4, True, True)
        assert result == HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")

        # test bitmap (should not affect bitmap)
        assert accountContext.setActiveCurrency(acBytes, 10, True, BALANCE_FLAG, 10) == acBytes

        # test bitmap, should affect
        result = accountContext.setActiveCurrency(acBytes, 4, True, BALANCE_FLAG, 10)
        currencies[1] = (4, True, True)
        assert result == HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")

    def test_active_insert_and_set_portfolio_flag(self, accountContext):
        currencies = [(2, True, True), (4, True, False), (512, False, True), (1024, True, False)]
        acBytes = HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")

        # is active and must insert
        result = accountContext.setActiveCurrency(acBytes, 1, True, PORTFOLIO_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [
                    (1, True, False),
                    (2, True, True),
                    (4, True, False),
                    (512, False, True),
                    (1024, True, False),
                ]
            ),
            "bytes18",
        )
        result = accountContext.setActiveCurrency(acBytes, 3, True, PORTFOLIO_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [
                    (2, True, True),
                    (3, True, False),
                    (4, True, False),
                    (512, False, True),
                    (1024, True, False),
                ]
            ),
            "bytes18",
        )
        result = accountContext.setActiveCurrency(acBytes, 513, True, PORTFOLIO_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [
                    (2, True, True),
                    (4, True, False),
                    (512, False, True),
                    (513, True, False),
                    (1024, True, False),
                ]
            ),
            "bytes18",
        )

        # is active and append to end
        result = accountContext.setActiveCurrency(acBytes, 1025, True, PORTFOLIO_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [
                    (2, True, True),
                    (4, True, False),
                    (512, False, True),
                    (1024, True, False),
                    (1025, True, False),
                ]
            ),
            "bytes18",
        )

    def test_active_insert_and_set_balance_flag(self, accountContext):
        currencies = [(2, True, True), (4, True, False), (512, False, True), (1024, True, False)]
        acBytes = HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")

        # is active and must insert
        result = accountContext.setActiveCurrency(acBytes, 1, True, BALANCE_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [
                    (1, False, True),
                    (2, True, True),
                    (4, True, False),
                    (512, False, True),
                    (1024, True, False),
                ]
            ),
            "bytes18",
        )
        result = accountContext.setActiveCurrency(acBytes, 3, True, BALANCE_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [
                    (2, True, True),
                    (3, False, True),
                    (4, True, False),
                    (512, False, True),
                    (1024, True, False),
                ]
            ),
            "bytes18",
        )
        result = accountContext.setActiveCurrency(acBytes, 513, True, BALANCE_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [
                    (2, True, True),
                    (4, True, False),
                    (512, False, True),
                    (513, False, True),
                    (1024, True, False),
                ]
            ),
            "bytes18",
        )

        # is active and append to end
        result = accountContext.setActiveCurrency(acBytes, 1025, True, BALANCE_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [
                    (2, True, True),
                    (4, True, False),
                    (512, False, True),
                    (1024, True, False),
                    (1025, False, True),
                ]
            ),
            "bytes18",
        )

        # duplicate tests with bitmap set
        # is active and must insert
        result = accountContext.setActiveCurrency(acBytes, 1, True, BALANCE_FLAG, 10)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [
                    (1, False, True),
                    (2, True, True),
                    (4, True, False),
                    (512, False, True),
                    (1024, True, False),
                ]
            ),
            "bytes18",
        )
        result = accountContext.setActiveCurrency(acBytes, 3, True, BALANCE_FLAG, 10)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [
                    (2, True, True),
                    (3, False, True),
                    (4, True, False),
                    (512, False, True),
                    (1024, True, False),
                ]
            ),
            "bytes18",
        )
        result = accountContext.setActiveCurrency(acBytes, 513, True, BALANCE_FLAG, 10)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [
                    (2, True, True),
                    (4, True, False),
                    (512, False, True),
                    (513, False, True),
                    (1024, True, False),
                ]
            ),
            "bytes18",
        )

        # is active and append to end
        result = accountContext.setActiveCurrency(acBytes, 1025, True, BALANCE_FLAG, 10)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [
                    (2, True, True),
                    (4, True, False),
                    (512, False, True),
                    (1024, True, False),
                    (1025, False, True),
                ]
            ),
            "bytes18",
        )

    def test_not_active_and_unset_portfolio_flag(self, accountContext):
        currencies = [(2, True, True), (4, True, False), (512, False, True), (1024, True, False)]
        acBytes = HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")

        # turn off portfolio flag for existing
        result = accountContext.setActiveCurrency(acBytes, 2, False, PORTFOLIO_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [(2, False, True), (4, True, False), (512, False, True), (1024, True, False)]
            ),
            "bytes18",
        )

        result = accountContext.setActiveCurrency(acBytes, 4, False, PORTFOLIO_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [(2, True, True), (512, False, True), (1024, True, False)]
            ),
            "bytes18",
        )

        assert accountContext.setActiveCurrency(acBytes, 512, False, PORTFOLIO_FLAG, 0) == acBytes

        result = accountContext.setActiveCurrency(acBytes, 1024, False, PORTFOLIO_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [(2, True, True), (4, True, False), (512, False, True)]
            ),
            "bytes18",
        )

    def test_not_active_and_unset_balance_flag(self, accountContext):
        currencies = [(2, True, True), (4, True, False), (512, False, True), (1024, False, True)]
        acBytes = HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")

        # turn off balance flag for existing
        result = accountContext.setActiveCurrency(acBytes, 2, False, BALANCE_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [(2, True, False), (4, True, False), (512, False, True), (1024, False, True)]
            ),
            "bytes18",
        )

        result = accountContext.setActiveCurrency(acBytes, 4, False, BALANCE_FLAG, 0)
        assert result == acBytes

        result = accountContext.setActiveCurrency(acBytes, 512, False, BALANCE_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [(2, True, True), (4, True, False), (1024, False, True)]
            ),
            "bytes18",
        )

        result = accountContext.setActiveCurrency(acBytes, 1024, False, BALANCE_FLAG, 0)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [(2, True, True), (4, True, False), (512, False, True)]
            ),
            "bytes18",
        )

        # Duplicate test for bitmap
        result = accountContext.setActiveCurrency(acBytes, 2, False, BALANCE_FLAG, 10)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [(2, True, False), (4, True, False), (512, False, True), (1024, False, True)]
            ),
            "bytes18",
        )

        result = accountContext.setActiveCurrency(acBytes, 4, False, BALANCE_FLAG, 10)
        assert result == acBytes

        result = accountContext.setActiveCurrency(acBytes, 512, False, BALANCE_FLAG, 10)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [(2, True, True), (4, True, False), (1024, False, True)]
            ),
            "bytes18",
        )

        result = accountContext.setActiveCurrency(acBytes, 1024, False, BALANCE_FLAG, 10)
        assert result == HexString(
            currencies_list_to_active_currency_bytes(
                [(2, True, True), (4, True, False), (512, False, True)]
            ),
            "bytes18",
        )

    def test_not_active_and_not_in_list(self, accountContext):
        currencies = [(2, True, True), (4, True, False), (512, False, True), (1024, True, False)]
        acBytes = HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")

        # not active and not in list
        assert accountContext.setActiveCurrency(acBytes, 3, False, PORTFOLIO_FLAG, 0) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 5, False, PORTFOLIO_FLAG, 0) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 513, False, PORTFOLIO_FLAG, 0) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 1025, False, PORTFOLIO_FLAG, 0) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 3, False, BALANCE_FLAG, 0) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 5, False, BALANCE_FLAG, 0) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 513, False, BALANCE_FLAG, 0) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 1025, False, BALANCE_FLAG, 0) == acBytes

        # test with bitmap set
        assert accountContext.setActiveCurrency(acBytes, 10, False, BALANCE_FLAG, 10) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 3, False, BALANCE_FLAG, 10) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 5, False, BALANCE_FLAG, 10) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 513, False, BALANCE_FLAG, 10) == acBytes
        assert accountContext.setActiveCurrency(acBytes, 1025, False, BALANCE_FLAG, 10) == acBytes

    def test_extend_list_too_long(self, accountContext):
        currencies = [
            (2, True, True),
            (4, True, False),
            (6, False, True),
            (8, True, False),
            (10, True, True),
            (12, True, False),
            (14, False, True),
            (16, True, False),
            (18, True, True),
        ]
        acBytes = HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")

        # is active and append to end, too long
        with brownie.reverts("AC: too many currencies"):
            accountContext.setActiveCurrency(acBytes, 20, True, PORTFOLIO_FLAG, 0)

        with brownie.reverts("AC: too many currencies"):
            accountContext.setActiveCurrency(acBytes, 20, True, BALANCE_FLAG, 0)

        # is active and must insert, too long
        with brownie.reverts("AC: too many currencies"):
            accountContext.setActiveCurrency(acBytes, 3, True, PORTFOLIO_FLAG, 0)

        with brownie.reverts("AC: too many currencies"):
            accountContext.setActiveCurrency(acBytes, 3, True, BALANCE_FLAG, 0)

        # duplicate tests with bitmap
        # is active and append to end, too long
        with brownie.reverts("AC: too many currencies"):
            accountContext.setActiveCurrency(acBytes, 20, True, PORTFOLIO_FLAG, 10)

        with brownie.reverts("AC: too many currencies"):
            accountContext.setActiveCurrency(acBytes, 20, True, BALANCE_FLAG, 10)

        # is active and must insert, too long
        with brownie.reverts("AC: too many currencies"):
            accountContext.setActiveCurrency(acBytes, 3, True, PORTFOLIO_FLAG, 10)

        with brownie.reverts("AC: too many currencies"):
            accountContext.setActiveCurrency(acBytes, 3, True, BALANCE_FLAG, 10)

    def test_clear_portfolio_flags(self, accountContext):
        currencies = [(2, True, True), (4, True, False), (512, False, True), (1024, True, False)]
        acBytes = HexString(currencies_list_to_active_currency_bytes(currencies), "bytes18")

        result = accountContext.clearPortfolioActiveFlags(acBytes)
        assert result == HexString(
            currencies_list_to_active_currency_bytes([(2, False, True), (512, False, True)]),
            "bytes18",
        )

    def test_enable_bitmap_currency(self, accountContext, accounts):
        accountContext.enableBitmapForAccount(accounts[0], 1, START_TIME)
        context = accountContext.getAccountContext(accounts[0])
        assert context[0] != 0
        assert context[3] == 1

        accountContext.enableBitmapForAccount(accounts[0], 4, START_TIME)
        context = accountContext.getAccountContext(accounts[0])
        assert context[0] != 0
        assert context[3] == 4

        accountContext.enableBitmapForAccount(accounts[0], 0, START_TIME)
        context = accountContext.getAccountContext(accounts[0])
        assert context[0] != 0
        assert context[3] == 0

    def test_enable_bitmap_currency_duplicate(self, accountContext, accounts):
        # Ensure that only the bitmap currency is logged as a record for the active currency
        activeCurrencies = HexString(
            currencies_list_to_active_currency_bytes([(1, False, True)]), "bytes18"
        )
        accountContext.setAccountContext((START_TIME, "0x00", 0, 0, activeCurrencies), accounts[0])
        accountContext.enableBitmapForAccount(accounts[0], 1, START_TIME)
        context = accountContext.getAccountContext(accounts[0])
        assert context[3] == 1
        assert context[0] != 0
        assert context[-1] == HexString(currencies_list_to_active_currency_bytes([]), "bytes18")

    def test_fail_enable_bitmap_currency(self, accountContext, accounts):
        with brownie.reverts("AC: invalid currency id"):
            accountContext.enableBitmapForAccount(accounts[0], 16384, START_TIME)

        with brownie.reverts("AC: cannot have assets"):
            accountContext.setAccountContext((START_TIME, "0x00", 1, 0, "0x00"), accounts[0])
            accountContext.enableBitmapForAccount(accounts[0], 1, START_TIME)

        with brownie.reverts("AC: cannot have assets"):
            accountContext.setAccountContext((START_TIME, "0x00", 0, 5, "0x00"), accounts[0])
            accountContext.setAssetBitmap(accounts[0], 5, "0x1")
            accountContext.enableBitmapForAccount(accounts[0], 1, START_TIME)
