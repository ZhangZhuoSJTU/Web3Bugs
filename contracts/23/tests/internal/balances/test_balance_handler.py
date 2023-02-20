import math

import brownie
import pytest
from brownie.convert.datatypes import Wei
from brownie.test import given, strategy
from hypothesis import settings
from scripts.config import CurrencyDefaults
from scripts.deployment import TestEnvironment, TokenType
from tests.helpers import currencies_list_to_active_currency_bytes, get_balance_state

DAI_CURRENCY_ID = 7


def convert_to_external(internalValue, externalPrecision):
    if externalPrecision > 1e8:
        # floating point weirdness with python
        return math.trunc(Wei(externalPrecision) / Wei(1e8)) * Wei(internalValue)
    else:
        return math.trunc(Wei(internalValue) * Wei(externalPrecision) / Wei(1e8))


def convert_to_internal(externalValue, externalPrecision):
    if externalPrecision < 1e8:
        # floating point weirdness with python
        return math.trunc(Wei(1e8) / Wei(externalPrecision)) * Wei(externalValue)
    else:
        return math.trunc(Wei(externalValue) * Wei(1e8) / Wei(externalPrecision))


@pytest.mark.balances
class TestBalanceHandler:
    @pytest.fixture(scope="module", autouse=True)
    def balanceHandler(self, MockBalanceHandler, MockERC20, accounts):
        handler = MockBalanceHandler.deploy({"from": accounts[0]})
        # Ensure that we have at least 2 bytes of currencies
        handler.setMaxCurrencyId(6)
        return handler

    @pytest.fixture(scope="module", autouse=True)
    def tokens(self, balanceHandler, MockERC20, accounts):
        tokens = []
        for i in range(1, 7):
            hasFee = i in [1, 2, 3]
            decimals = [6, 8, 18, 6, 8, 18][i - 1]
            fee = 0.01e18 if hasFee else 0

            token = MockERC20.deploy(str(i), str(i), decimals, fee, {"from": accounts[0]})
            balanceHandler.setCurrencyMapping(
                i, False, (token.address, hasFee, TokenType["NonMintable"])
            )
            token.approve(balanceHandler.address, 2 ** 255, {"from": accounts[0]})
            token.transfer(balanceHandler.address, 1e20, {"from": accounts[0]})
            tokens.append(token)

        return tokens

    @pytest.fixture(scope="module", autouse=True)
    def cTokenEnvironment(self, balanceHandler, accounts):
        env = TestEnvironment(accounts[0])
        env.enableCurrency("DAI", CurrencyDefaults)
        currencyId = DAI_CURRENCY_ID
        balanceHandler.setCurrencyMapping(
            currencyId, True, (env.token["DAI"].address, False, TokenType["UnderlyingToken"])
        )
        balanceHandler.setCurrencyMapping(
            currencyId, False, (env.cToken["DAI"].address, False, TokenType["cToken"])
        )
        env.token["DAI"].approve(balanceHandler.address, 2 ** 255, {"from": accounts[0]})
        env.cToken["DAI"].approve(balanceHandler.address, 2 ** 255, {"from": accounts[0]})

        return env

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    @given(
        currencyId=strategy("uint", min_value=1, max_value=6),
        assetBalance=strategy("int88", min_value=-10e18, max_value=10e18),
        perpetualTokenBalance=strategy("uint80", max_value=10e18),
        netCashChange=strategy("int88", min_value=-10e18, max_value=10e18),
        netTransfer=strategy("int88", min_value=-10e18, max_value=10e18),
        netNTokenTransfer=strategy("int88", min_value=-10e18, max_value=10e18),
    )
    @settings(max_examples=10)
    def test_build_and_finalize_balances(
        self,
        balanceHandler,
        accounts,
        currencyId,
        assetBalance,
        perpetualTokenBalance,
        netCashChange,
        netTransfer,
        netNTokenTransfer,
        tokens,
    ):
        active_currencies = currencies_list_to_active_currency_bytes([(currencyId, False, True)])
        balanceHandler.setBalance(accounts[0], currencyId, assetBalance, perpetualTokenBalance)
        context = (0, "0x00", 0, 0, active_currencies)

        (bs, context) = balanceHandler.loadBalanceState(accounts[0], currencyId, context)
        assert bs[0] == currencyId
        assert bs[1] == assetBalance
        assert bs[2] == perpetualTokenBalance
        assert bs[3] == 0

        bsCopy = list(bs)
        bsCopy[3] = netCashChange
        bsCopy[4] = netTransfer
        bsCopy[5] = netNTokenTransfer

        # These scenarios should fail
        if netTransfer < 0 and assetBalance + netCashChange + netTransfer < 0:
            # Cannot withdraw to a negative balance
            with brownie.reverts("Neg withdraw"):
                context = balanceHandler.finalize(bsCopy, accounts[0], context, False)
        elif perpetualTokenBalance + netNTokenTransfer < 0:
            with brownie.reverts("Neg withdraw"):
                context = balanceHandler.finalize(bsCopy, accounts[0], context, False)
        else:
            # check that the balances match on the token balances and on the the storage
            balanceBefore = tokens[currencyId - 1].balanceOf(balanceHandler.address)
            txn = balanceHandler.finalize(bsCopy, accounts[0], context, False)
            balanceAfter = tokens[currencyId - 1].balanceOf(balanceHandler.address)

            contextSecond = txn.return_value
            (bsFinal, _) = balanceHandler.loadBalanceState(accounts[0], currencyId, contextSecond)
            assert bsFinal[0] == currencyId

            currency = balanceHandler.getCurrencyMapping(currencyId, False)
            externalPrecision = currency[2]
            transferExternal = convert_to_external(netTransfer, externalPrecision)

            # Assert hasDebt is set properly (storedCashBalance + netCashChange + netTransfer)
            if currency[1] and netTransfer > 0:
                fee = transferExternal // 100
                transferWithFeeInternal = convert_to_internal(
                    transferExternal - fee, externalPrecision
                )
                if bsCopy[1] + bsCopy[3] + transferWithFeeInternal < 0:
                    assert contextSecond[1] == "0x02"
                else:
                    assert contextSecond[1] == "0x00"
            elif bsCopy[1] + bsCopy[3] + netTransfer < 0:
                assert contextSecond[1] == "0x02"
            else:
                assert contextSecond[1] == "0x00"

            # Has transfer fee
            if currency[1]:
                fee = transferExternal // 100
                transferWithFeeInternal = convert_to_internal(
                    transferExternal - fee, externalPrecision
                )
                if netTransfer > 0:
                    # On deposits the fee will matter
                    assert (
                        pytest.approx(balanceAfter - balanceBefore, abs=2) == transferExternal - fee
                    )
                    assert (
                        pytest.approx(bsFinal[1], abs=2)
                        == bsCopy[1] + bsCopy[3] + transferWithFeeInternal
                    )
                else:
                    # On withdraws the fee will not matter
                    assert balanceAfter - balanceBefore == transferExternal
                    # TODO: dust can accrue here, what to do?
                    assert pytest.approx(bsFinal[1], abs=10) == bsCopy[1] + bsCopy[3] + netTransfer

            else:
                assert bsFinal[1] == bsCopy[1] + bsCopy[3] + convert_to_internal(
                    transferExternal, externalPrecision
                )
                assert balanceAfter - balanceBefore == transferExternal

            assert bsFinal[2] == bsCopy[2] + netNTokenTransfer

    @given(
        currencyId=strategy("uint", min_value=1, max_value=6),
        assetBalance=strategy("int88", min_value=-10e18, max_value=10e18),
        netCashChange=strategy("int88", min_value=-10e18, max_value=10e18),
        netTransfer=strategy("int88", min_value=-10e18, max_value=10e18),
    )
    @settings(max_examples=10)
    def test_deposit_asset_token(
        self, balanceHandler, tokens, accounts, currencyId, assetBalance, netCashChange, netTransfer
    ):
        assetDeposit = int(100e8)
        tolerance = 2
        bs = get_balance_state(
            currencyId,
            storedCashBalance=assetBalance,
            netCashChange=netCashChange,
            netAssetTransferInternalPrecision=netTransfer,
        )

        currency = balanceHandler.getCurrencyMapping(currencyId, False)
        externalPrecision = currency[2]
        assetDepositExternal = convert_to_external(assetDeposit, externalPrecision)

        if currency[1]:
            # Has transfer fee
            fee = assetDepositExternal // 100
            # Asset deposit in internal precision post fee
            assetDeposit = convert_to_internal(assetDepositExternal - fee, externalPrecision)

        # without cash balance, should simply be a deposit into the account, only transfer
        # amounts change
        balanceBefore = tokens[currencyId - 1].balanceOf(balanceHandler.address)
        txn = balanceHandler.depositAssetToken(bs, accounts[0], assetDepositExternal, False)
        balanceAfter = tokens[currencyId - 1].balanceOf(balanceHandler.address)
        (newBalanceState, assetAmountInternal) = txn.return_value

        # Need to truncate precision difference
        assert pytest.approx(
            newBalanceState[1] + newBalanceState[3] + newBalanceState[4], abs=tolerance
        ) == (
            assetBalance
            + netCashChange
            + netTransfer
            + convert_to_internal(
                convert_to_external(assetDeposit, externalPrecision), externalPrecision
            )
        )

        if currency[1]:
            # Token has a fee then the transfer as occurred
            assert (
                pytest.approx(balanceAfter - balanceBefore, abs=tolerance)
                == assetDepositExternal - fee
            )
            assert pytest.approx(newBalanceState[3], abs=tolerance) == netCashChange + assetDeposit
        else:
            assert balanceBefore == balanceAfter
            assert pytest.approx(
                newBalanceState[4], abs=tolerance
            ) == netTransfer + convert_to_internal(assetDepositExternal, externalPrecision)

        assert pytest.approx(assetAmountInternal, abs=tolerance) == assetDeposit

    @given(underlyingAmount=strategy("int88", min_value=0, max_value=10e18))
    @settings(max_examples=10)
    def test_deposit_and_withdraw_underlying_asset_token(
        self, balanceHandler, cTokenEnvironment, accounts, underlyingAmount
    ):
        # deposit asset tokens
        currencyId = DAI_CURRENCY_ID
        underlyingBalanceBefore = cTokenEnvironment.token["DAI"].balanceOf(balanceHandler.address)
        balanceBefore = cTokenEnvironment.cToken["DAI"].balanceOf(balanceHandler.address)

        bs = get_balance_state(currencyId)
        txn = balanceHandler.depositUnderlyingToken(bs, accounts[0], underlyingAmount)

        balanceAfter = cTokenEnvironment.cToken["DAI"].balanceOf(balanceHandler.address)
        underlyingBalanceAfter = cTokenEnvironment.token["DAI"].balanceOf(balanceHandler.address)

        # test balance after
        (newBalanceState, assetTokensReceived) = txn.return_value

        assert balanceAfter - balanceBefore == assetTokensReceived
        assert underlyingBalanceBefore == underlyingBalanceAfter
        assert assetTokensReceived == newBalanceState[3]

        # withdraw asset
        balanceBefore = cTokenEnvironment.cToken["DAI"].balanceOf(balanceHandler.address)
        underlyingBalanceBefore = cTokenEnvironment.token["DAI"].balanceOf(balanceHandler.address)
        accountUnderlyingBalanceBefore = cTokenEnvironment.token["DAI"].balanceOf(
            accounts[0].address
        )

        active_currencies = currencies_list_to_active_currency_bytes([(currencyId, False, True)])
        context = (0, "0x00", 0, 0, active_currencies)
        # withdraw all the asset tokens received
        bs = get_balance_state(
            currencyId,
            storedCashBalance=assetTokensReceived,
            netAssetTransferInternalPrecision=-assetTokensReceived,
        )
        txn = balanceHandler.finalize(bs, accounts[0], context, True)

        underlyingBalanceAfter = cTokenEnvironment.token["DAI"].balanceOf(balanceHandler.address)
        balanceAfter = cTokenEnvironment.cToken["DAI"].balanceOf(balanceHandler.address)
        accountUnderlyingBalanceAfter = cTokenEnvironment.token["DAI"].balanceOf(
            accounts[0].address
        )

        assert balanceBefore - balanceAfter == assetTokensReceived
        # balance handler should not have any net underlying balance
        assert underlyingBalanceBefore == underlyingBalanceAfter
        if assetTokensReceived > 0:
            assert accountUnderlyingBalanceAfter > accountUnderlyingBalanceBefore

    def test_redeem_to_underlying_doesnt_fail_on_positive(
        self, balanceHandler, accounts, cTokenEnvironment
    ):
        currencyId = DAI_CURRENCY_ID
        cTokenEnvironment.token["DAI"].approve(
            cTokenEnvironment.cToken["DAI"].address, 2 ** 255, {"from": accounts[0]}
        )
        cTokenEnvironment.cToken["DAI"].mint(10000e18, {"from": accounts[0]})
        active_currencies = currencies_list_to_active_currency_bytes([(currencyId, False, True)])
        context = (0, "0x00", 0, 0, active_currencies)

        (bs, context) = balanceHandler.loadBalanceState(accounts[0], currencyId, context)
        bsCopy = list(bs)
        bsCopy[4] = 100e8

        assetBalanceBefore = cTokenEnvironment.cToken["DAI"].balanceOf(accounts[0])
        balanceHandler.finalize(bsCopy, accounts[0], context, True)
        (bsAfter, _) = balanceHandler.loadBalanceState(accounts[0], currencyId, context)
        assetBalanceAfter = cTokenEnvironment.cToken["DAI"].balanceOf(accounts[0])
        assert bsAfter[1] == 100e8
        assert assetBalanceBefore - assetBalanceAfter == 100e8
