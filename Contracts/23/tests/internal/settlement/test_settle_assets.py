import itertools
import random

import pytest
from brownie.test import given, strategy
from tests.constants import MARKETS, SETTLEMENT_DATE
from tests.helpers import get_market_state, get_portfolio_array

NUM_CURRENCIES = 3
SETTLEMENT_RATE = [
    (18, MARKETS[0], 0.01e18),
    (18, MARKETS[1], 0.02e18),
    (18, MARKETS[2], 0.03e18),
    (18, MARKETS[3], 0.04e18),
    (18, MARKETS[4], 0.05e18),
    (18, MARKETS[5], 0.06e18),
    (18, MARKETS[6], 0.07e18),
]

SETTLED_RATE = 0.01e18


def get_settle_rate(currencyId, maturity):
    if maturity == MARKETS[0]:
        rate = SETTLEMENT_RATE[0][2]
    elif maturity == MARKETS[1]:
        rate = SETTLEMENT_RATE[1][2]
    else:
        rate = SETTLED_RATE * currencyId
    return rate


@pytest.mark.settlement
class TestSettleAssets:
    @pytest.fixture(scope="module", autouse=True)
    def mockAggregators(self, MockCToken, cTokenAggregator, accounts):
        # Deploy 8 different aggregators for each currency
        aggregators = []
        for i in range(0, NUM_CURRENCIES):
            mockToken = MockCToken.deploy(8, {"from": accounts[0]})
            mock = cTokenAggregator.deploy(mockToken.address, {"from": accounts[0]})
            # Set the settlement rate to be set
            mockToken.setAnswer(0.01e18 * (i + 1))
            aggregators.append(mock)

        return aggregators

    @pytest.fixture(scope="module", autouse=True)
    def mockSettleAssets(self, MockSettleAssets, mockAggregators, accounts):
        contract = MockSettleAssets.deploy({"from": accounts[0]})

        # Set the mock aggregators
        contract.setMaxCurrencyId(NUM_CURRENCIES)
        for i, a in enumerate(mockAggregators):
            currencyId = i + 1
            contract.setAssetRateMapping(currencyId, (a.address, 8))

            # Set market state
            for m in MARKETS:
                marketState = get_market_state(m)
                contract.setMarketState(currencyId, SETTLEMENT_DATE, m, marketState)

                # Set settlement rates for markets 0, 1
                if m == MARKETS[0]:
                    contract.setSettlementRate(i + 1, m, SETTLEMENT_RATE[0][2], 8)
                elif m == MARKETS[1]:
                    contract.setSettlementRate(i + 1, m, SETTLEMENT_RATE[1][2], 8)

        return contract

    def generate_asset_array(self, numAssets):
        cashGroups = [(i, 4) for i in range(1, NUM_CURRENCIES)]
        assets = get_portfolio_array(numAssets, cashGroups)
        if len(assets) == 0:
            return (assets, 0)

        nextSettleTime = min([a[1] for a in assets])

        random.shuffle(assets)
        return (assets, nextSettleTime)

    def assert_rates_settled(self, mockSettleAssets, assetArray, blockTime):
        for a in assetArray:
            if a[1] < blockTime and a[1] not in (MARKETS[0], MARKETS[1]):
                (_, rate, _) = mockSettleAssets.getSettlementRate(a[0], a[1])
                assert rate == (SETTLED_RATE * a[0])

    def assert_markets_updated(self, mockSettleAssets, assetArray):
        for a in assetArray:
            # is liquidity token
            if a[2] > 1:
                maturity = MARKETS[a[2] - 2]
                value = mockSettleAssets.getSettlementMarket(a[0], maturity, SETTLEMENT_DATE)
                assert value[1:4] == (int(1e18) - a[3], int(1e18) - a[3], int(1e18) - a[3])

    def settled_balance_context(self, assetArray, blockTime):
        assetsSorted = sorted(assetArray)
        settledBalances = []
        remainingAssets = []

        for a in assetsSorted:
            # fcash asset type
            if a[2] == 1 and a[1] < blockTime:
                rate = get_settle_rate(a[0], a[1])
                cashClaim = a[3] * 1e18 / rate
                settledBalances.append((a[0], cashClaim))
            elif a[2] > 1 and a[1] < blockTime:
                # Settle both cash and fCash claims
                cashClaim = a[3]
                settledBalances.append((a[0], cashClaim))

                rate = get_settle_rate(a[0], a[1])
                fCashClaim = a[3] * 1e18 / rate
                settledBalances.append((a[0], fCashClaim))
            elif a[2] > 1 and SETTLEMENT_DATE < blockTime:
                # Settle cash claim, leave behind fCash
                cashClaim = a[3]
                settledBalances.append((a[0], cashClaim))

                fCashClaim = a[3]
                remainingAssets.append((a[0], a[1], 1, fCashClaim))
            else:
                remainingAssets.append(a)

        # Group by currency id and sum settled values
        return (
            [
                (key, sum(int(num) for _, num in value))
                for key, value in itertools.groupby(settledBalances, lambda x: x[0])
            ],
            list(
                filter(
                    lambda x: x[3] != 0,
                    [
                        (key[0], key[1], key[2], sum(int(a[3]) for a in value))
                        for key, value in itertools.groupby(
                            remainingAssets, lambda x: (x[0], x[1], x[2])
                        )
                    ],
                )
            ),
        )

    @given(numAssets=strategy("uint", min_value=0, max_value=6))
    @pytest.mark.no_call_coverage
    def test_settle_assets(self, mockSettleAssets, mockAggregators, accounts, numAssets):
        # SETUP TEST
        blockTime = random.choice(MARKETS[0:3]) + random.randint(0, 6000)
        (assetArray, nextSettleTime) = self.generate_asset_array(numAssets)

        # Set state
        mockSettleAssets.setAssetArray(accounts[1], assetArray)

        # This will assert the values from the view match the values from the stateful method
        settleAmounts = mockSettleAssets.settlePortfolio(accounts[1], blockTime).return_value
        assets = mockSettleAssets.getAssetArray(accounts[1])

        # Assert that net balance change are equal
        (computedSettleAmounts, remainingAssets) = self.settled_balance_context(
            assetArray, blockTime
        )
        assert len(settleAmounts) == len(computedSettleAmounts)
        for i, sa in enumerate(settleAmounts):
            assert sa[0] == computedSettleAmounts[i][0]
            assert pytest.approx(sa[1], rel=1e-12) == computedSettleAmounts[i][1]

        # Assert that the rate is set after
        self.assert_rates_settled(mockSettleAssets, assetArray, blockTime)

        # Assert that markets have been updated
        self.assert_markets_updated(mockSettleAssets, assetArray)

        # Assert that remaining assets are ok
        assets = [(a[0], a[1], a[2], a[3]) for a in assets]
        assert sorted(assets) == sorted(remainingAssets)
