import random

import pytest
from brownie.convert.datatypes import HexString
from brownie.network.state import Chain
from brownie.test import given, strategy
from tests.constants import START_TIME
from tests.helpers import active_currencies_to_list, get_portfolio_array, get_settlement_date

chain = Chain()


def generate_asset_array(num_assets):
    cashGroups = [(1, 7), (2, 7), (3, 7)]
    return get_portfolio_array(num_assets, cashGroups)


@pytest.mark.portfolio
class TestPortfolioHandler:
    @pytest.fixture(scope="module", autouse=True)
    def portfolioHandler(self, MockPortfolioHandler, accounts):
        handler = MockPortfolioHandler.deploy({"from": accounts[0]})
        chain.mine(1, timestamp=START_TIME)

        return handler

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    @given(num_assets=strategy("uint", min_value=0, max_value=6))
    # TODO: why is six the max value here
    def test_portfolio_sorting(self, portfolioHandler, accounts, num_assets):
        newAssets = generate_asset_array(num_assets)
        portfolioHandler.storeAssets(accounts[1], ([], newAssets, num_assets, 0))

        computedSort = tuple([p[0:3] for p in sorted(newAssets)])
        sortedArray = portfolioHandler.getAssetArray(accounts[1])
        assert computedSort == tuple([s[0:3] for s in sortedArray])

    def test_add_repeated_new_asset(self, portfolioHandler, accounts):
        state = portfolioHandler.buildPortfolioState(accounts[1], 0)
        state = portfolioHandler.addAsset(state, 1, 1000, 1, 100e8)
        state = portfolioHandler.addAsset(state, 1, 1000, 1, 100e8)
        assert len(state[1]) == 1
        assert state[1][0][3] == 200e8

    @given(num_assets=strategy("uint", min_value=0, max_value=7))
    def test_add_delete_assets(self, portfolioHandler, accounts, num_assets):
        assetArray = generate_asset_array(num_assets + 5)
        startingAssets = assetArray[0:num_assets]
        newAssets = assetArray[num_assets:]

        portfolioHandler.storeAssets(accounts[1], ([], startingAssets, len(startingAssets), 0))
        state = portfolioHandler.buildPortfolioState(accounts[1], 0)
        # build portfolio state returns a sorted list
        startingAssets = list(state[0])

        # deletes will always come before adds
        num_deletes = random.randint(0, len(startingAssets))
        delete_indexes = sorted(random.sample(range(0, len(startingAssets)), num_deletes))

        # settling will result in indexes being deleted in order
        for d in delete_indexes:
            state = portfolioHandler.deleteAsset(state, d)
            # Assert that asset has been marked as removed
            assert state[0][d][5] == 2
            assert state[-1] == len([x for x in state[0] if x[5] != 2])
            tmp = list(startingAssets[d])
            tmp[3] = 0  # mark notional as zero
            startingAssets[d] = tuple(tmp)

        # do 5 random add asset operations
        for i in range(0, 5):
            action = random.randint(0, 2)
            activeIndexes = [i for i, x in enumerate(state[0]) if x[5] != 2]
            if len(activeIndexes) == 0:
                action = 0

            if action == 0:
                # insert a new asset
                newAsset = newAssets[i]

                state = portfolioHandler.addAsset(
                    state,
                    newAsset[0],  # currency id
                    newAsset[1],  # maturity
                    newAsset[2],  # asset type
                    newAsset[3],  # notional
                )

                assert state[1][-1] == newAsset
                startingAssets.append(newAsset)

            elif action == 1:
                # update an asset
                index = random.sample(activeIndexes, 1)[0]
                asset = state[0][index]
                if asset[2] >= 2:
                    notional = random.randint(-asset[3], 1e18)
                else:
                    notional = random.randint(-1e18, 1e18)

                state = portfolioHandler.addAsset(
                    state,
                    asset[0],  # currency id
                    asset[1],  # maturity
                    asset[2],  # asset type
                    notional,
                )

                assert state[0][index][5] == 1
                assert state[0][index][3] == asset[3] + notional
                tmp = list(startingAssets[index])
                tmp[3] += notional
                startingAssets[index] = tuple(tmp)

            elif action == 2:
                # net off an asset
                index = random.sample(activeIndexes, 1)[0]
                asset = state[0][index]
                notional = asset[3] * -1

                state = portfolioHandler.addAsset(
                    state,
                    asset[0],  # currency id
                    asset[1],  # maturity
                    asset[2],  # asset type
                    notional,
                )

                assert state[0][index][5] == 1
                assert state[0][index][3] == asset[3] + notional
                tmp = list(startingAssets[index])
                tmp[3] = 0  # mark notional as zero
                startingAssets[index] = tuple(tmp)

        txn = portfolioHandler.storeAssets(accounts[1], state)
        (context) = txn.return_value
        finalStored = portfolioHandler.getAssetArray(accounts[1])
        # Filter out the active assets with zero notional from the computed list
        finalComputed = tuple(list(filter(lambda x: x[3] != 0, startingAssets)))

        assert context[2] == len(finalComputed)  # assert length is correct

        # assert nextSettleTime is correct
        if len(finalComputed) == 0:
            assert context[0] == 0
        else:
            assert context[0] == min([get_settlement_date(x, chain.time()) for x in finalComputed])

        # assert that hasDebt is correct
        if len(finalComputed) == 0:
            assert context[1] == "0x00"
        else:
            hasDebt = (min([x[3] for x in finalComputed])) < 0
            if hasDebt:
                assert context[1] != "0x00"
            else:
                assert context[1] == "0x00"

        # assert that active currencies has all the currencies
        if len(finalComputed) == 0:
            assert context[4] == HexString("0x00", "bytes18")
        else:
            activeCurrencyList = list(
                filter(lambda x: x != 0, sorted(active_currencies_to_list(context[4])))
            )
            currencies = list(sorted(set([(x[0], True, False) for x in finalComputed])))
            assert activeCurrencyList == currencies

        assert sorted([x[0:4] for x in finalStored]) == sorted([(x[0:4]) for x in finalComputed])
