import math

import brownie
import pytest
from brownie.convert.datatypes import Wei
from brownie.network.state import Chain
from scripts.config import CurrencyDefaults
from scripts.deployment import TestEnvironment
from tests.constants import RATE_PRECISION, SECONDS_IN_DAY, SECONDS_IN_QUARTER, SECONDS_IN_YEAR
from tests.helpers import get_balance_action, get_tref
from tests.stateful.invariants import check_system_invariants

chain = Chain()
INITIAL_CASH_AMOUNT = 100000e8


@pytest.fixture(scope="module", autouse=True)
def environment(accounts):
    env = TestEnvironment(accounts[0])
    env.enableCurrency("DAI", CurrencyDefaults)

    cToken = env.cToken["DAI"]
    token = env.token["DAI"]
    token.approve(cToken.address, 2 ** 255, {"from": accounts[0]})
    cToken.mint(10000000e18, {"from": accounts[0]})
    cToken.approve(env.proxy.address, 2 ** 255, {"from": accounts[0]})

    # Set the blocktime to the beginning of the next tRef otherwise the rates will blow up
    blockTime = chain.time()
    newTime = get_tref(blockTime) + SECONDS_IN_QUARTER + 1
    chain.mine(1, timestamp=newTime)

    return env


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass


def initialize_markets(environment, accounts):
    currencyId = 2
    environment.notional.updateDepositParameters(currencyId, [0.4e8, 0.6e8], [0.8e9, 0.8e9])

    environment.notional.updateInitializationParameters(
        currencyId, [0.01e9, 0.021e9], [0.5e9, 0.5e9]
    )

    environment.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(
                currencyId, "DepositAssetAndMintNToken", depositActionAmount=INITIAL_CASH_AMOUNT
            )
        ],
        {"from": accounts[0]},
    )
    environment.notional.initializeMarkets(currencyId, True)


def get_maturities(index):
    blockTime = chain.time()
    tRef = blockTime - blockTime % SECONDS_IN_QUARTER
    maturity = []
    if index >= 1:
        maturity.append(tRef + SECONDS_IN_QUARTER)

    if index >= 2:
        maturity.append(tRef + 2 * SECONDS_IN_QUARTER)

    if index >= 3:
        maturity.append(tRef + SECONDS_IN_YEAR)

    if index >= 4:
        maturity.append(tRef + 2 * SECONDS_IN_YEAR)

    if index >= 5:
        maturity.append(tRef + 5 * SECONDS_IN_YEAR)

    if index >= 6:
        maturity.append(tRef + 7 * SECONDS_IN_YEAR)

    if index >= 7:
        maturity.append(tRef + 10 * SECONDS_IN_YEAR)

    if index >= 8:
        maturity.append(tRef + 15 * SECONDS_IN_YEAR)

    if index >= 9:
        maturity.append(tRef + 20 * SECONDS_IN_YEAR)

    return maturity


def interpolate_market_rate(a, b, isSixMonth=False):
    shortMaturity = a[1]
    longMaturity = b[1]
    shortRate = a[6]
    longRate = b[6]

    if isSixMonth:
        return math.trunc(
            abs(
                (longRate - shortRate) * SECONDS_IN_QUARTER / (longMaturity - shortMaturity)
                + shortRate
            )
        )
    else:
        return math.trunc(
            abs(
                (longRate - shortRate)
                * (longMaturity + SECONDS_IN_QUARTER - shortMaturity)
                / (longMaturity - shortMaturity)
                + shortRate
            )
        )


def ntoken_asserts(environment, currencyId, isFirstInit, accounts, wasInit=True):
    blockTime = chain.time()
    nTokenAddress = environment.notional.nTokenAddress(currencyId)
    (cashBalance, perpTokenBalance, lastMintTime) = environment.notional.getAccountBalance(
        currencyId, nTokenAddress
    )

    (cashGroup, assetRate) = environment.notional.getCashGroupAndAssetRate(currencyId)
    (portfolio, ifCashAssets) = environment.notional.getNTokenPortfolio(nTokenAddress)
    (depositShares, leverageThresholds) = environment.notional.getDepositParameters(currencyId)
    (_, proportions) = environment.notional.getInitializationParameters(currencyId)
    maturity = get_maturities(cashGroup[0])
    markets = environment.notional.getActiveMarkets(currencyId)
    previousMarkets = environment.notional.getActiveMarketsAtBlockTime(
        currencyId, blockTime - SECONDS_IN_QUARTER
    )

    # assert perp token has no cash left
    assert cashBalance == 0
    assert perpTokenBalance == 0
    assert lastMintTime == 0

    # assert that perp token has liquidity tokens
    assert len(portfolio) == cashGroup[0]  # max market index

    # These values are used to calculate non first init liquidity values
    totalAssetCashInMarkets = sum([m[3] for m in markets])

    for (i, asset) in enumerate(portfolio):
        assert asset[0] == currencyId
        # assert liquidity token is on a valid maturity date
        assert asset[1] == maturity[i]
        # assert liquidity tokens are ordered
        assert asset[2] == 2 + i
        # assert that liquidity is proportional to deposit shares

        if isFirstInit:
            # Initialize amount is a percentage of the initial cash amount
            assert asset[3] == INITIAL_CASH_AMOUNT * depositShares[i] / int(1e8)
        elif wasInit:
            # Initialize amount is a percentage of the net cash amount
            assert asset[3] == totalAssetCashInMarkets * depositShares[i] / 1e8

    assert len(ifCashAssets) >= len(portfolio)
    for (i, asset) in enumerate(ifCashAssets):
        assert asset[0] == currencyId
        assert asset[1] == maturity[i]
        assert asset[2] == 1
        # assert that perp token has an fCash asset
        # TODO: this should be a combination of previous fCash value, and the net added
        # TODO: it's possible for this to be zero
        assert asset[3] < 0

    for (i, market) in enumerate(markets):
        assert market[1] == maturity[i]
        # all market liquidity is from the perp token
        assert market[4] == portfolio[i][3]

        totalCashUnderlying = (market[3] * Wei(1e8) * assetRate[1]) / (assetRate[2] * Wei(1e18))
        proportion = int(market[2] * RATE_PRECISION / (totalCashUnderlying + market[2]))
        # assert that market proportions are not above leverage thresholds
        assert proportion <= leverageThresholds[i]

        # Ensure that fCash is greater than zero
        assert market[3] > 0

        if previousMarkets[i][6] == 0:
            # This means that the market is initialized for the first time
            assert pytest.approx(proportion, abs=2) == proportions[i]
        elif proportion == leverageThresholds[i]:
            # In this case then the oracle rate is set by governance using Market.getImpliedRate
            pass
        elif i == 0:
            # The 3 month market should have the same implied rate as the old 6 month
            assert market[5] == previousMarkets[1][5]
        elif i == 1:
            # In any other scenario then the market's oracleRate must be in line with
            # the oracle rate provided by the previous markets, this is a special case
            # for the 6 month market
            if len(previousMarkets) >= 3 and previousMarkets[2][6] != 0:
                # In this case we can interpolate between the old 6 month and 1yr
                computedOracleRate = interpolate_market_rate(
                    previousMarkets[1], previousMarkets[2], isSixMonth=True
                )
                assert pytest.approx(market[5], abs=2) == computedOracleRate
                assert pytest.approx(market[6], abs=2) == computedOracleRate
            else:
                # In this case then the proportion is set by governance (there is no
                # future rate to interpolate against)
                assert pytest.approx(proportion, abs=2) == proportions[i]
        else:
            # In this scenario the market is interpolated against the previous two rates
            computedOracleRate = interpolate_market_rate(markets[i - 1], previousMarkets[i])
            assert pytest.approx(market[5], abs=2) == computedOracleRate
            assert pytest.approx(market[6], abs=2) == computedOracleRate

    # TODO: where to check last initialized time?
    # accountContext = environment.notional.getAccountContext(nTokenAddress)
    # assert accountContext[0] < get_tref(blockTime) + SECONDS_IN_QUARTER

    check_system_invariants(environment, accounts)


def test_first_initialization(environment, accounts):
    currencyId = 2
    with brownie.reverts("IM: insufficient cash"):
        # no parameters are set
        environment.notional.initializeMarkets(currencyId, True)

    environment.notional.updateDepositParameters(currencyId, [0.4e8, 0.6e8], [0.8e9, 0.8e9])

    environment.notional.updateInitializationParameters(
        currencyId, [0.02e9, 0.02e9], [0.5e9, 0.5e9]
    )

    with brownie.reverts("IM: insufficient cash"):
        # no cash deposits
        environment.notional.initializeMarkets(currencyId, True)

    environment.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(
                currencyId, "DepositAssetAndMintNToken", depositActionAmount=INITIAL_CASH_AMOUNT
            )
        ],
        {"from": accounts[0]},
    )
    environment.notional.initializeMarkets(currencyId, True)
    ntoken_asserts(environment, currencyId, True, accounts)


def test_settle_and_initialize(environment, accounts):
    initialize_markets(environment, accounts)
    currencyId = 2
    blockTime = chain.time()
    chain.mine(1, timestamp=(blockTime + SECONDS_IN_QUARTER))

    # No trading has occured
    environment.notional.initializeMarkets(currencyId, False)
    ntoken_asserts(environment, currencyId, False, accounts)


def test_settle_and_extend(environment, accounts):
    initialize_markets(environment, accounts)
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
    chain.mine(1, timestamp=(blockTime + SECONDS_IN_QUARTER))

    environment.notional.initializeMarkets(currencyId, False)
    ntoken_asserts(environment, currencyId, False, accounts)

    # Test re-initialization the second time
    blockTime = chain.time()
    chain.mine(1, timestamp=(blockTime + SECONDS_IN_QUARTER))

    environment.notional.initializeMarkets(currencyId, False)
    ntoken_asserts(environment, currencyId, False, accounts)


def test_mint_after_markets_initialized(environment, accounts):
    initialize_markets(environment, accounts)
    currencyId = 2

    marketsBefore = environment.notional.getActiveMarkets(currencyId)
    tokensToMint = environment.notional.calculateNTokensToMint(currencyId, 100000e8)
    (
        cashBalanceBefore,
        perpTokenBalanceBefore,
        lastMintTimeBefore,
    ) = environment.notional.getAccountBalance(currencyId, accounts[0])

    # Ensure that the clock ticks forward for lastMintTime check
    blockTime = chain.time() + 1
    chain.mine(1, timestamp=blockTime)

    environment.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(
                currencyId, "DepositAssetAndMintNToken", depositActionAmount=INITIAL_CASH_AMOUNT
            )
        ],
        {"from": accounts[0]},
    )
    ntoken_asserts(environment, currencyId, False, accounts, wasInit=False)
    # Assert that no assets in portfolio
    assert len(environment.notional.getAccountPortfolio(accounts[0])) == 0

    marketsAfter = environment.notional.getActiveMarkets(currencyId)
    (
        cashBalanceAfter,
        perpTokenBalanceAfter,
        lastMintTimeAfter,
    ) = environment.notional.getAccountBalance(currencyId, accounts[0])

    # assert increase in market liquidity
    assert len(marketsBefore) == len(marketsAfter)
    for (i, m) in enumerate(marketsBefore):
        assert m[4] < marketsAfter[i][4]

    # assert account balances are in line
    assert cashBalanceBefore == cashBalanceAfter
    assert perpTokenBalanceAfter == perpTokenBalanceBefore + tokensToMint
    assert lastMintTimeAfter > lastMintTimeBefore


def test_redeem_to_zero_fails(environment, accounts):
    initialize_markets(environment, accounts)
    currencyId = 2

    with brownie.reverts("Cannot redeem to zero"):
        environment.notional.nTokenRedeem(
            accounts[0].address, currencyId, INITIAL_CASH_AMOUNT, True, {"from": accounts[0]}
        )

    # This can succeed
    environment.notional.nTokenRedeem(
        accounts[0].address, currencyId, INITIAL_CASH_AMOUNT - 1e8, True, {"from": accounts[0]}
    )

    nTokenAddress = environment.notional.nTokenAddress(currencyId)
    (portfolio, ifCashAssets) = environment.notional.getNTokenPortfolio(nTokenAddress)

    # assert no assets in perp token
    assert len(portfolio) == 2
    assert len(ifCashAssets) == 2

    environment.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(
                currencyId, "DepositAssetAndMintNToken", depositActionAmount=INITIAL_CASH_AMOUNT
            )
        ],
        {"from": accounts[0]},
    )


def test_failing_initialize_time(environment, accounts):
    initialize_markets(environment, accounts)
    currencyId = 2

    # Initializing again immediately will fail
    with brownie.reverts("IM: invalid time"):
        environment.notional.initializeMarkets(currencyId, False)

    blockTime = chain.time()
    chain.mine(1, timestamp=(blockTime + SECONDS_IN_QUARTER))

    # Cannot mint until markets are initialized
    with brownie.reverts("PT: requires settlement"):
        environment.notional.batchBalanceAction(
            accounts[0],
            [
                get_balance_action(
                    currencyId, "DepositAssetAndMintNToken", depositActionAmount=INITIAL_CASH_AMOUNT
                )
            ],
            {"from": accounts[0]},
        )

    with brownie.reverts("PT: requires settlement"):
        environment.notional.nTokenRedeem(
            accounts[0].address, currencyId, 100e8, True, {"from": accounts[0]}
        )


def test_constant_oracle_rates_across_initialize_time(environment, accounts):
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
        currencyId, [0.01e9, 0.021e9, 0.02e9, 0.02e9], [0.5e9, 0.5e9, 0.5e9, 0.5e9]
    )

    environment.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(
                currencyId, "DepositAssetAndMintNToken", depositActionAmount=INITIAL_CASH_AMOUNT
            )
        ],
        {"from": accounts[0]},
    )

    # Assert that market rates will be the same no matter when we do the first initialization
    blockHeight = chain.height
    environment.notional.initializeMarkets(currencyId, True)
    ntoken_asserts(environment, currencyId, True, accounts)
    marketsBefore = environment.notional.getActiveMarkets(currencyId)

    chain.undo(chain.height - blockHeight)
    chain.mine(1, timestamp=(chain.time() + 45 * SECONDS_IN_DAY))
    environment.notional.initializeMarkets(currencyId, True)
    ntoken_asserts(environment, currencyId, True, accounts)
    marketsAfter = environment.notional.getActiveMarkets(currencyId)

    # Check that oracle rates are invariant relative to the two initialization times
    assert len(marketsBefore) == len(marketsAfter)
    for i in range(0, len(marketsBefore)):
        assert pytest.approx(marketsAfter[i][5], abs=10) == marketsBefore[i][5]
        assert pytest.approx(marketsAfter[i][6], abs=10) == marketsBefore[i][6]


def test_delayed_second_initialize_markets(environment, accounts):
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
        currencyId, [0.01e9, 0.021e9, 0.02e9, 0.02e9], [0.5e9, 0.5e9, 0.5e9, 0.5e9]
    )

    environment.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(
                currencyId, "DepositAssetAndMintNToken", depositActionAmount=INITIAL_CASH_AMOUNT
            )
        ],
        {"from": accounts[0]},
    )

    environment.notional.initializeMarkets(currencyId, True)
    ntoken_asserts(environment, currencyId, True, accounts)

    blockTime = chain.time()
    chain.mine(1, timestamp=(blockTime + SECONDS_IN_QUARTER + SECONDS_IN_DAY * 65))
    environment.notional.initializeMarkets(currencyId, False)
    ntoken_asserts(environment, currencyId, False, accounts)
