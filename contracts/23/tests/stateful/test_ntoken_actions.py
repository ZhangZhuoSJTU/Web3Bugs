import brownie
import pytest
from brownie.convert.datatypes import Wei
from brownie.network.state import Chain
from scripts.config import CurrencyDefaults
from tests.constants import RATE_PRECISION, SECONDS_IN_DAY, SECONDS_IN_QUARTER, SECONDS_IN_YEAR
from tests.helpers import get_balance_action, get_balance_trade_action, initialize_environment
from tests.stateful.invariants import check_system_invariants

chain = Chain()


@pytest.fixture(scope="module", autouse=True)
def environment(accounts):
    return initialize_environment(accounts)


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass


def get_market_proportion(currencyId, environment):
    proportions = []
    (cashGroup, assetRate) = environment.notional.getCashGroupAndAssetRate(currencyId)
    markets = environment.notional.getActiveMarkets(currencyId)
    for (i, market) in enumerate(markets):
        totalCashUnderlying = (market[3] * Wei(1e8) * assetRate[1]) / (assetRate[2] * Wei(1e18))
        proportion = int(market[2] * RATE_PRECISION / (totalCashUnderlying + market[2]))
        proportions.append(proportion)

    return proportions


def test_deleverage_markets_no_lend(environment, accounts):
    # Lending does not succeed when markets are over levered, cash goes into cash balance
    currencyId = 2
    environment.notional.updateDepositParameters(currencyId, [0.4e8, 0.6e8], [0.4e9, 0.4e9])

    nTokenAddress = environment.notional.nTokenAddress(currencyId)
    (portfolioBefore, ifCashAssetsBefore) = environment.notional.getNTokenPortfolio(nTokenAddress)
    marketsBefore = environment.notional.getActiveMarkets(currencyId)
    totalSupplyBefore = environment.nToken[currencyId].totalSupply()

    environment.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(
                currencyId, "DepositAssetAndMintNToken", depositActionAmount=50000000e8
            )
        ],
        {"from": accounts[0]},
    )

    (portfolioAfter, ifCashAssetsAfter) = environment.notional.getNTokenPortfolio(nTokenAddress)
    balanceAfter = environment.notional.getAccountBalance(currencyId, nTokenAddress)
    marketsAfter = environment.notional.getActiveMarkets(currencyId)
    reserveBalance = environment.notional.getReserveBalance(currencyId)
    totalSupplyAfter = environment.nToken[currencyId].totalSupply()

    assert portfolioBefore == portfolioAfter
    assert ifCashAssetsBefore == ifCashAssetsAfter
    assert balanceAfter[0] == 50000000e8
    assert marketsBefore == marketsAfter
    assert reserveBalance == 0
    assert totalSupplyBefore + 50000000e8 == totalSupplyAfter

    check_system_invariants(environment, accounts)


def test_deleverage_markets_lend(environment, accounts):
    # Lending does succeed with a smaller balance
    currencyId = 2
    environment.notional.updateDepositParameters(currencyId, [0.4e8, 0.6e8], [0.4e9, 0.4e9])

    nTokenAddress = environment.notional.nTokenAddress(currencyId)
    (portfolioBefore, ifCashAssetsBefore) = environment.notional.getNTokenPortfolio(nTokenAddress)
    totalSupplyBefore = environment.nToken[currencyId].totalSupply()
    marketProportionsBefore = get_market_proportion(currencyId, environment)

    environment.notional.batchBalanceAction(
        accounts[0],
        [get_balance_action(currencyId, "DepositAssetAndMintNToken", depositActionAmount=50000e8)],
        {"from": accounts[0]},
    )

    (portfolioAfter, ifCashAssetsAfter) = environment.notional.getNTokenPortfolio(nTokenAddress)
    balanceAfter = environment.notional.getAccountBalance(currencyId, nTokenAddress)
    reserveBalance = environment.notional.getReserveBalance(currencyId)
    totalSupplyAfter = environment.nToken[currencyId].totalSupply()
    marketProportionsAfter = get_market_proportion(currencyId, environment)

    assert portfolioBefore == portfolioAfter

    for (assetBefore, assetAfter) in zip(ifCashAssetsBefore, ifCashAssetsAfter):
        assert assetBefore[3] < assetAfter[3]

    for (proportionBefore, proportionAfter) in zip(marketProportionsBefore, marketProportionsAfter):
        assert proportionBefore > proportionAfter

    # Minimum residual left
    assert balanceAfter[0] < 500e8
    assert reserveBalance > 0
    assert totalSupplyBefore + 50000e8 == totalSupplyAfter

    check_system_invariants(environment, accounts)


def test_deleverage_markets_lend_and_provide(environment, accounts):
    # Lending does not succeed when markets are over levered, cash goes into cash balance
    currencyId = 2
    environment.notional.updateDepositParameters(currencyId, [0.4e8, 0.6e8], [0.49999e9, 0.49999e9])

    nTokenAddress = environment.notional.nTokenAddress(currencyId)
    (portfolioBefore, ifCashAssetsBefore) = environment.notional.getNTokenPortfolio(nTokenAddress)
    totalSupplyBefore = environment.nToken[currencyId].totalSupply()
    marketProportionsBefore = get_market_proportion(currencyId, environment)

    environment.notional.batchBalanceAction(
        accounts[0],
        [get_balance_action(currencyId, "DepositAssetAndMintNToken", depositActionAmount=500000e8)],
        {"from": accounts[0]},
    )

    (portfolioAfter, ifCashAssetsAfter) = environment.notional.getNTokenPortfolio(nTokenAddress)
    balanceAfter = environment.notional.getAccountBalance(currencyId, nTokenAddress)
    reserveBalance = environment.notional.getReserveBalance(currencyId)
    totalSupplyAfter = environment.nToken[currencyId].totalSupply()
    marketProportionsAfter = get_market_proportion(currencyId, environment)

    for (assetBefore, assetAfter) in zip(portfolioBefore, portfolioAfter):
        assert assetBefore[3] < assetAfter[3]

    for (assetBefore, assetAfter) in zip(ifCashAssetsBefore, ifCashAssetsAfter):
        assert assetBefore[3] < assetAfter[3]

    for (proportionBefore, proportionAfter) in zip(marketProportionsBefore, marketProportionsAfter):
        assert proportionBefore > proportionAfter

    # No residual left
    assert balanceAfter[0] == 0
    assert reserveBalance > 0
    assert totalSupplyBefore + 500000e8 == totalSupplyAfter

    check_system_invariants(environment, accounts)


def test_redeem_tokens_and_sell_fcash(environment, accounts):
    currencyId = 2
    (
        cashBalanceBefore,
        perpTokenBalanceBefore,
        lastMintTimeBefore,
    ) = environment.notional.getAccountBalance(currencyId, accounts[0])

    nTokenAddress = environment.notional.nTokenAddress(currencyId)
    (portfolioBefore, ifCashAssetsBefore) = environment.notional.getNTokenPortfolio(nTokenAddress)

    action = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [
            {"tradeActionType": "Lend", "marketIndex": 1, "notional": 100e8, "minSlippage": 0},
            {"tradeActionType": "Lend", "marketIndex": 2, "notional": 100e8, "minSlippage": 0},
        ],
        depositActionAmount=300e18,
        withdrawEntireCashBalance=True,
    )
    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})

    marketsBefore = environment.notional.getActiveMarkets(currencyId)
    environment.notional.nTokenRedeem(
        accounts[0].address, currencyId, 1e8, True, {"from": accounts[0]}
    )
    marketsAfter = environment.notional.getActiveMarkets(currencyId)

    (portfolioAfter, ifCashAssetsAfter) = environment.notional.getNTokenPortfolio(nTokenAddress)
    (
        cashBalanceAfter,
        perpTokenBalanceAfter,
        lastMintTimeAfter,
    ) = environment.notional.getAccountBalance(currencyId, accounts[0])

    # Assert that no assets in portfolio
    assert len(environment.notional.getAccountPortfolio(accounts[0])) == 0

    # assert decrease in market liquidity
    assert len(marketsBefore) == len(marketsAfter)
    for (i, m) in enumerate(marketsBefore):
        assert m[4] > marketsAfter[i][4]

    assert cashBalanceAfter > cashBalanceBefore
    assert perpTokenBalanceAfter == perpTokenBalanceBefore - 1e8
    assert lastMintTimeAfter > lastMintTimeBefore

    check_system_invariants(environment, accounts)


def test_redeem_tokens_and_save_assets_portfolio(environment, accounts):
    currencyId = 2
    (
        cashBalanceBefore,
        perpTokenBalanceBefore,
        lastMintTimeBefore,
    ) = environment.notional.getAccountBalance(currencyId, accounts[0])

    totalSupplyBefore = environment.nToken[currencyId].totalSupply()

    action = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [
            {"tradeActionType": "Lend", "marketIndex": 1, "notional": 100e8, "minSlippage": 0},
            {"tradeActionType": "Lend", "marketIndex": 2, "notional": 100e8, "minSlippage": 0},
        ],
        depositActionAmount=300e18,
        withdrawEntireCashBalance=True,
    )
    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})

    marketsBefore = environment.notional.getActiveMarkets(currencyId)
    environment.notional.nTokenRedeem(
        accounts[0].address, currencyId, 1e8, False, {"from": accounts[0]}
    )
    marketsAfter = environment.notional.getActiveMarkets(currencyId)

    (
        cashBalanceAfter,
        perpTokenBalanceAfter,
        lastMintTimeAfter,
    ) = environment.notional.getAccountBalance(currencyId, accounts[0])
    totalSupplyAfter = environment.nToken[currencyId].totalSupply()

    portfolio = environment.notional.getAccountPortfolio(accounts[0])
    for asset in portfolio:
        # Should be a net borrower because of lending
        assert asset[3] < 0

    # assert decrease in market liquidity
    assert len(marketsBefore) == len(marketsAfter)
    for (i, m) in enumerate(marketsBefore):
        assert m[4] > marketsAfter[i][4]

    # Some cash claim withdrawn
    assert cashBalanceAfter > cashBalanceBefore
    assert perpTokenBalanceAfter == perpTokenBalanceBefore - 1e8
    assert lastMintTimeAfter > lastMintTimeBefore
    assert totalSupplyBefore - totalSupplyAfter == 1e8

    check_system_invariants(environment, accounts)


def test_redeem_tokens_and_save_assets_settle(environment, accounts):
    currencyId = 2
    (
        cashBalanceBefore,
        perpTokenBalanceBefore,
        lastMintTimeBefore,
    ) = environment.notional.getAccountBalance(currencyId, accounts[0])

    action = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [
            {"tradeActionType": "Borrow", "marketIndex": 1, "notional": 10e8, "maxSlippage": 0},
            {"tradeActionType": "Lend", "marketIndex": 2, "notional": 100e8, "minSlippage": 0},
        ],
        depositActionAmount=300e18,
        withdrawEntireCashBalance=True,
    )
    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})
    environment.nToken[currencyId].transfer(accounts[1], 10e8, {"from": accounts[0]})

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    # This account has a matured borrow fCash
    txn = environment.notional.nTokenRedeem(
        accounts[1].address, currencyId, 1e8, False, {"from": accounts[1]}
    )
    assert txn.events["AccountSettled"]
    context = environment.notional.getAccountContext(accounts[1])
    assert context[1] == "0x02"

    check_system_invariants(environment, accounts)


def test_redeem_tokens_and_save_assets_bitmap(environment, accounts):
    currencyId = 2
    (
        cashBalanceBefore,
        perpTokenBalanceBefore,
        lastMintTimeBefore,
    ) = environment.notional.getAccountBalance(currencyId, accounts[0])

    action = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [
            {"tradeActionType": "Borrow", "marketIndex": 1, "notional": 10e8, "maxSlippage": 0},
            {"tradeActionType": "Lend", "marketIndex": 2, "notional": 100e8, "minSlippage": 0},
        ],
        depositActionAmount=300e18,
        withdrawEntireCashBalance=True,
    )
    environment.notional.enableBitmapCurrency(currencyId, {"from": accounts[1]})
    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})
    portfolioBefore = environment.notional.getAccountPortfolio(accounts[1])

    environment.nToken[currencyId].transfer(accounts[1], 10e8, {"from": accounts[0]})

    # This account has a matured borrow fCash
    environment.notional.nTokenRedeem(
        accounts[1].address, currencyId, 1e8, False, {"from": accounts[1]}
    )
    portfolio = environment.notional.getAccountPortfolio(accounts[1])
    assert len(portfolio) == 2
    assert portfolio[0][1] == portfolioBefore[0][1]
    assert portfolio[0][3] > portfolioBefore[0][3]
    assert portfolio[1][1] == portfolioBefore[1][1]
    assert portfolio[1][3] < portfolioBefore[1][3]

    check_system_invariants(environment, accounts)


def test_purchase_ntoken_residual_negative(environment, accounts):
    currencyId = 2
    cashGroup = list(environment.notional.getCashGroup(currencyId))
    # Enable the one year market
    cashGroup[0] = 3
    cashGroup[9] = CurrencyDefaults["tokenHaircut"][0:3]
    cashGroup[10] = CurrencyDefaults["rateScalar"][0:3]
    environment.notional.updateCashGroup(currencyId, cashGroup)

    environment.notional.updateDepositParameters(
        currencyId, [0.4e8, 0.4e8, 0.2e8], [0.8e9, 0.8e9, 0.8e9]
    )

    environment.notional.updateInitializationParameters(
        currencyId, [0.01e9, 0.021e9, 0.07e9], [0.5e9, 0.5e9, 0.5e9]
    )

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    # Do some trading to leave some perp token residual
    action = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [{"tradeActionType": "Lend", "marketIndex": 3, "notional": 100e8, "minSlippage": 0}],
        depositActionAmount=100e18,
        withdrawEntireCashBalance=True,
    )
    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})

    # Now settle the markets, should be some residual
    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    nTokenAddress = environment.notional.nTokenAddress(currencyId)
    (portfolioBefore, ifCashAssetsBefore) = environment.notional.getNTokenPortfolio(nTokenAddress)
    (cashBalanceBefore, _, _) = environment.notional.getAccountBalance(currencyId, nTokenAddress)

    with brownie.reverts("Insufficient block time"):
        action = get_balance_trade_action(
            2,
            "None",
            [
                {
                    "tradeActionType": "PurchaseNTokenResidual",
                    "maturity": ifCashAssetsBefore[2][1],
                    "fCashAmountToPurchase": ifCashAssetsBefore[2][3],
                }
            ],
        )
        environment.notional.batchBalanceAndTradeAction(
            accounts[2], [action], {"from": accounts[2]}
        )

    with brownie.reverts("Invalid maturity"):
        action = get_balance_trade_action(
            2,
            "None",
            [
                {
                    "tradeActionType": "PurchaseNTokenResidual",
                    "maturity": ifCashAssetsBefore[1][1],
                    "fCashAmountToPurchase": ifCashAssetsBefore[2][3],
                }
            ],
        )
        environment.notional.batchBalanceAndTradeAction(
            accounts[2], [action], {"from": accounts[2]}
        )

    blockTime = chain.time()
    # 96 hour buffer period
    chain.mine(1, timestamp=blockTime + 96 * 3600)

    with brownie.reverts("Invalid amount"):
        action = get_balance_trade_action(
            2,
            "None",
            [
                {
                    "tradeActionType": "PurchaseNTokenResidual",
                    "maturity": ifCashAssetsBefore[2][1],
                    "fCashAmountToPurchase": 100e8,
                }
            ],
        )
        environment.notional.batchBalanceAndTradeAction(
            accounts[2], [action], {"from": accounts[2]}
        )

    environment.cToken["DAI"].transfer(accounts[2], 5000e8, {"from": accounts[0]})
    environment.cToken["DAI"].approve(environment.notional.address, 2 ** 255, {"from": accounts[2]})
    action = get_balance_trade_action(
        2,
        "DepositAsset",
        [
            {
                "tradeActionType": "PurchaseNTokenResidual",
                "maturity": ifCashAssetsBefore[2][1],
                "fCashAmountToPurchase": ifCashAssetsBefore[2][3],
            }
        ],
        depositActionAmount=5000e8,
    )
    environment.notional.batchBalanceAndTradeAction(accounts[2], [action], {"from": accounts[2]})

    (portfolioAfter, ifCashAssetsAfter) = environment.notional.getNTokenPortfolio(nTokenAddress)
    (cashBalanceAfter, _, _) = environment.notional.getAccountBalance(currencyId, nTokenAddress)
    (accountCashBalance, _, _) = environment.notional.getAccountBalance(currencyId, accounts[2])
    accountPortfolio = environment.notional.getAccountPortfolio(accounts[2])

    assert portfolioAfter == portfolioBefore
    assert accountCashBalance == cashBalanceBefore - cashBalanceAfter + 5000e8
    assert accountPortfolio[0][0:3] == ifCashAssetsBefore[2][0:3]
    assert len(ifCashAssetsAfter) == 3

    check_system_invariants(environment, accounts)


def test_purchase_perp_token_residual_positive(environment, accounts):
    currencyId = 2
    cashGroup = list(environment.notional.getCashGroup(currencyId))
    # Enable the one year market
    cashGroup[0] = 3
    cashGroup[9] = CurrencyDefaults["tokenHaircut"][0:3]
    cashGroup[10] = CurrencyDefaults["rateScalar"][0:3]
    environment.notional.updateCashGroup(currencyId, cashGroup)

    environment.notional.updateDepositParameters(
        currencyId, [0.4e8, 0.4e8, 0.2e8], [0.8e9, 0.8e9, 0.8e9]
    )

    environment.notional.updateInitializationParameters(
        currencyId, [0.01e9, 0.021e9, 0.07e9], [0.5e9, 0.5e9, 0.5e9]
    )

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    # Do some trading to leave some perp token residual
    collateral = get_balance_trade_action(1, "DepositUnderlying", [], depositActionAmount=10e18)

    action = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [{"tradeActionType": "Borrow", "marketIndex": 3, "notional": 100e8, "maxSlippage": 0}],
        depositActionAmount=100e18,
        withdrawEntireCashBalance=True,
    )

    environment.notional.batchBalanceAndTradeAction(
        accounts[1], [collateral, action], {"from": accounts[1], "value": 10e18}
    )

    # Now settle the markets, should be some residual
    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    nTokenAddress = environment.notional.nTokenAddress(currencyId)
    (portfolioBefore, ifCashAssetsBefore) = environment.notional.getNTokenPortfolio(nTokenAddress)
    (cashBalanceBefore, _, _) = environment.notional.getAccountBalance(currencyId, nTokenAddress)

    blockTime = chain.time()
    # 96 hour buffer period
    chain.mine(1, timestamp=blockTime + 96 * 3600)

    with brownie.reverts("Invalid amount"):
        action = get_balance_trade_action(
            2,
            "None",
            [
                {
                    "tradeActionType": "PurchaseNTokenResidual",
                    "maturity": ifCashAssetsBefore[2][1],
                    "fCashAmountToPurchase": -100e8,
                }
            ],
        )
        environment.notional.batchBalanceAndTradeAction(
            accounts[2], [action], {"from": accounts[2]}
        )

    with brownie.reverts("Insufficient cash"):
        action = get_balance_trade_action(
            2,
            "None",
            [
                {
                    "tradeActionType": "PurchaseNTokenResidual",
                    "maturity": ifCashAssetsBefore[2][1],
                    "fCashAmountToPurchase": ifCashAssetsBefore[2][3],
                }
            ],
        )
        environment.notional.batchBalanceAndTradeAction(
            accounts[2], [action], {"from": accounts[2]}
        )

    # Use a different account
    action = get_balance_trade_action(
        2,
        "DepositAsset",
        [
            {
                "tradeActionType": "PurchaseNTokenResidual",
                "maturity": ifCashAssetsBefore[2][1],
                "fCashAmountToPurchase": ifCashAssetsBefore[2][3],
            }
        ],
        depositActionAmount=5500e8,
    )
    environment.notional.batchBalanceAndTradeAction(accounts[0], [action], {"from": accounts[0]})

    (portfolioAfter, ifCashAssetsAfter) = environment.notional.getNTokenPortfolio(nTokenAddress)
    (cashBalanceAfter, _, _) = environment.notional.getAccountBalance(currencyId, nTokenAddress)
    (accountCashBalance, _, _) = environment.notional.getAccountBalance(currencyId, accounts[0])
    accountPortfolio = environment.notional.getAccountPortfolio(accounts[0])

    assert portfolioAfter == portfolioBefore
    assert 5500e8 - accountCashBalance == cashBalanceAfter
    assert accountPortfolio[0][0:3] == ifCashAssetsBefore[2][0:3]
    assert len(ifCashAssetsAfter) == 3

    check_system_invariants(environment, accounts)


def test_transfer_tokens(environment, accounts):
    currencyId = 2
    totalSupplyBefore = environment.nToken[currencyId].totalSupply()
    assert totalSupplyBefore == environment.nToken[currencyId].balanceOf(accounts[0])
    (_, _, accountOneLastMintTime) = environment.notional.getAccountBalance(currencyId, accounts[1])
    assert accountOneLastMintTime == 0

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + 10 * SECONDS_IN_DAY)
    txn = environment.nToken[currencyId].transfer(accounts[1], 100e8)

    assert txn.events["Transfer"][0]["from"] == accounts[0]
    assert txn.events["Transfer"][0]["to"] == accounts[1]
    assert txn.events["Transfer"][0]["value"] == 100e8
    assert environment.nToken[currencyId].totalSupply() == totalSupplyBefore
    assert environment.nToken[currencyId].balanceOf(accounts[1]) == 100e8
    assert environment.nToken[currencyId].balanceOf(accounts[0]) == totalSupplyBefore - 100e8
    assert environment.noteERC20.balanceOf(accounts[0]) > 0
    assert environment.noteERC20.balanceOf(accounts[1]) == 0

    (_, _, mintTimeAfterZero) = environment.notional.getAccountBalance(currencyId, accounts[0])
    (_, _, mintTimeAfterOne) = environment.notional.getAccountBalance(currencyId, accounts[1])
    assert mintTimeAfterOne == mintTimeAfterZero == txn.timestamp

    check_system_invariants(environment, accounts)


def test_mint_incentives(environment, accounts):
    currencyId = 2
    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_YEAR)
    balanceBefore = environment.noteERC20.balanceOf(accounts[0])
    incentivesClaimed = environment.notional.nTokenGetClaimableIncentives(
        accounts[0].address, chain.time()
    )
    txn = environment.notional.nTokenClaimIncentives()
    balanceAfter = environment.noteERC20.balanceOf(accounts[0])

    assert balanceAfter - balanceBefore == incentivesClaimed
    assert pytest.approx(incentivesClaimed, rel=1e-4) == 100000e8 * 3
    assert (
        environment.notional.nTokenGetClaimableIncentives(accounts[0].address, txn.timestamp) == 0
    )

    (_, _, mintTimeAfterZero) = environment.notional.getAccountBalance(currencyId, accounts[0])
    assert mintTimeAfterZero == txn.timestamp

    check_system_invariants(environment, accounts)


def test_mint_bitmap_incentives(environment, accounts):
    # NOTE: this test is a little flaky when running with the entire test suite
    currencyId = 2
    environment.notional.enableBitmapCurrency(2, {"from": accounts[0]})

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_YEAR)
    balanceBefore = environment.noteERC20.balanceOf(accounts[0])
    incentivesClaimed = environment.notional.nTokenGetClaimableIncentives(
        accounts[0].address, chain.time()
    )
    txn = environment.notional.nTokenClaimIncentives()
    balanceAfter = environment.noteERC20.balanceOf(accounts[0])

    assert balanceAfter - balanceBefore == incentivesClaimed
    assert pytest.approx(incentivesClaimed, rel=1e-4) == 100000e8 * 3
    assert (
        environment.notional.nTokenGetClaimableIncentives(accounts[0].address, txn.timestamp) == 0
    )

    (_, _, mintTimeAfterZero) = environment.notional.getAccountBalance(currencyId, accounts[0])
    assert mintTimeAfterZero == txn.timestamp

    check_system_invariants(environment, accounts)


def test_cannot_transfer_ntoken_to_ntoken(environment, accounts):
    environment.nToken[2].approve(accounts[1], 200e8, {"from": accounts[0]})

    with brownie.reverts():
        environment.nToken[2].transfer(environment.nToken[3].address, 100e8, {"from": accounts[0]})

    with brownie.reverts():
        environment.nToken[2].transfer(environment.nToken[2].address, 100e8, {"from": accounts[0]})

    with brownie.reverts():
        environment.nToken[2].transferFrom(
            accounts[0].address, environment.nToken[3].address, 100e8, {"from": accounts[1]}
        )

    with brownie.reverts():
        environment.nToken[2].transferFrom(
            accounts[0].address, environment.nToken[2].address, 100e8, {"from": accounts[1]}
        )


def test_transfer_allowance(environment, accounts):
    assert environment.nToken[2].balanceOf(accounts[2]) == 0
    environment.nToken[2].approve(accounts[1], 200e8, {"from": accounts[0]})
    environment.nToken[2].transferFrom(
        accounts[0].address, accounts[2].address, 100e8, {"from": accounts[1]}
    )
    assert environment.nToken[2].balanceOf(accounts[2]) == 100e8


def test_transfer_all_allowance(environment, accounts):
    assert environment.nToken[1].balanceOf(accounts[2]) == 0
    assert environment.nToken[2].balanceOf(accounts[2]) == 0
    environment.notional.nTokenTransferApproveAll(accounts[1], 500e8, {"from": accounts[0]})
    environment.nToken[2].transferFrom(
        accounts[0].address, accounts[2].address, 100e8, {"from": accounts[1]}
    )
    environment.nToken[1].transferFrom(
        accounts[0].address, accounts[2].address, 100e8, {"from": accounts[1]}
    )
    assert environment.nToken[1].balanceOf(accounts[2]) == 100e8
    assert environment.nToken[2].balanceOf(accounts[2]) == 100e8


def test_purchase_perp_token_residual_and_sweep_cash(environment, accounts):
    currencyId = 2
    cashGroup = list(environment.notional.getCashGroup(currencyId))
    # Enable the two year markets
    cashGroup[0] = 4
    cashGroup[9] = CurrencyDefaults["tokenHaircut"][0:4]
    cashGroup[10] = CurrencyDefaults["rateScalar"][0:4]
    environment.notional.updateCashGroup(currencyId, cashGroup)

    environment.notional.updateDepositParameters(
        currencyId, [0.4e8, 0.2e8, 0.2e8, 0.2e8], [0.8e9, 0.8e9, 0.8e9, 0.8e9]
    )

    environment.notional.updateInitializationParameters(
        currencyId, [0.01e9, 0.021e9, 0.07e9, 0.08e9], [0.5e9, 0.5e9, 0.5e9, 0.5e9]
    )

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    collateral = get_balance_trade_action(1, "DepositUnderlying", [], depositActionAmount=10e18)
    action = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [
            # This leaves a positive residual
            {"tradeActionType": "Borrow", "marketIndex": 3, "notional": 100e8, "maxSlippage": 0},
            # This leaves a negative residual
            {"tradeActionType": "Lend", "marketIndex": 4, "notional": 100e8, "minSlippage": 0},
        ],
        depositActionAmount=100e18,
        withdrawEntireCashBalance=True,
    )

    environment.notional.batchBalanceAndTradeAction(
        accounts[1], [collateral, action], {"from": accounts[1], "value": 10e18}
    )

    # Now settle the markets, should be some residual
    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    nTokenAddress = environment.notional.nTokenAddress(currencyId)
    (portfolioBefore, ifCashAssetsBefore) = environment.notional.getNTokenPortfolio(nTokenAddress)

    blockTime = chain.time()
    # 96 hour buffer period
    chain.mine(1, timestamp=blockTime + 96 * 3600)

    residualPurchaseAction = get_balance_trade_action(
        2,
        "DepositAsset",
        [
            {
                "tradeActionType": "PurchaseNTokenResidual",
                "maturity": ifCashAssetsBefore[2][1],
                "fCashAmountToPurchase": ifCashAssetsBefore[2][3],
            }
        ],
        depositActionAmount=5500e8,
    )
    environment.notional.batchBalanceAndTradeAction(
        accounts[0], [residualPurchaseAction], {"from": accounts[0]}
    )

    (
        _,
        totalSupplyBefore,
        _,
        _,
        _,
        cashBalanceBefore,
        _,
        _,
    ) = environment.notional.getNTokenAccount(nTokenAddress)
    txn = environment.notional.sweepCashIntoMarkets(2)
    (portfolioAfter, _) = environment.notional.getNTokenPortfolio(nTokenAddress)
    (_, totalSupplyAfter, _, _, _, cashBalanceAfter, _, _) = environment.notional.getNTokenAccount(
        nTokenAddress
    )
    cashIntoMarkets = txn.events["SweepCashIntoMarkets"]["cashIntoMarkets"]

    assert totalSupplyBefore == totalSupplyAfter
    assert cashBalanceBefore - cashBalanceAfter == cashIntoMarkets

    for (assetBefore, assetAfter) in zip(portfolioBefore, portfolioAfter):
        assert assetAfter[3] > assetBefore[3]

    check_system_invariants(environment, accounts)


def test_can_reduce_erc20_approval(environment, accounts):
    environment.nToken[2].approve(accounts[1], 200e8, {"from": accounts[0]})
    environment.nToken[2].approve(accounts[1], 100e8, {"from": accounts[0]})


def test_redeem_tokens_and_sell_fcash_zero_notional(environment, accounts):
    # This unit test is here to test a bug where markets were skipped during the sellfCash portion
    # of redeeming nTokens
    currencyId = 2
    cashGroup = list(environment.notional.getCashGroup(currencyId))
    # Enable the two year markets
    cashGroup[0] = 4
    cashGroup[9] = CurrencyDefaults["tokenHaircut"][0:4]
    cashGroup[10] = CurrencyDefaults["rateScalar"][0:4]
    environment.notional.updateCashGroup(currencyId, cashGroup)

    environment.notional.updateDepositParameters(
        currencyId, [0.4e8, 0.2e8, 0.2e8, 0.2e8], [0.8e9, 0.8e9, 0.8e9, 0.8e9]
    )

    environment.notional.updateInitializationParameters(
        currencyId, [0.01e9, 0.021e9, 0.07e9, 0.08e9], [0.5e9, 0.5e9, 0.5e9, 0.5e9]
    )

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    collateral = get_balance_trade_action(1, "DepositUnderlying", [], depositActionAmount=10e18)
    action = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [
            # This leaves a positive residual
            {"tradeActionType": "Borrow", "marketIndex": 3, "notional": 1e4, "maxSlippage": 0},
            # This leaves a negative residual
            {"tradeActionType": "Lend", "marketIndex": 4, "notional": 1e4, "minSlippage": 0},
        ],
        depositActionAmount=100e18,
        withdrawEntireCashBalance=True,
    )

    environment.notional.batchBalanceAndTradeAction(
        accounts[1], [collateral, action], {"from": accounts[1], "value": 10e18}
    )

    # Now settle the markets, should be some residual
    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    nTokenAddress = environment.notional.nTokenAddress(currencyId)
    (portfolioBefore, ifCashAssetsBefore) = environment.notional.getNTokenPortfolio(nTokenAddress)

    # Leaves some more residual
    action = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [
            {"tradeActionType": "Borrow", "marketIndex": 1, "notional": 100e8, "maxSlippage": 0},
            {"tradeActionType": "Lend", "marketIndex": 2, "notional": 100e8, "minSlippage": 0},
            {"tradeActionType": "Lend", "marketIndex": 3, "notional": 100e8, "minSlippage": 0},
            {"tradeActionType": "Lend", "marketIndex": 4, "notional": 100e8, "minSlippage": 0},
        ],
        depositActionAmount=500e18,
        withdrawEntireCashBalance=True,
    )
    environment.notional.batchBalanceAndTradeAction(
        accounts[1], [collateral, action], {"from": accounts[1], "value": 10e18}
    )

    # Need to ensure that no residual assets are left behind
    assert len(environment.notional.getAccountPortfolio(accounts[0])) == 0
    environment.notional.nTokenRedeem(
        accounts[0].address, currencyId, 1e8, True, {"from": accounts[0]}
    )

    assert len(environment.notional.getAccountPortfolio(accounts[0])) == 0
    check_system_invariants(environment, accounts)
