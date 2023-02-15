import math
import random

import brownie
import pytest
from brownie.test import given, strategy
from tests.constants import START_TIME


@pytest.mark.ntoken
class TestNTokenSettings:
    @pytest.fixture(scope="module", autouse=True)
    def nToken(self, MockNTokenHandler, accounts):
        return accounts[0].deploy(MockNTokenHandler)

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    @given(currencyId=strategy("uint16"), tokenAddress=strategy("address"))
    def test_set_perpetual_token_setters(self, nToken, currencyId, tokenAddress):
        # This has assertions inside
        nToken.setNTokenAddress(currencyId, tokenAddress)
        # TODO: more secure test is to set random bits and then ensure that our
        # current settings make it properly

        assert nToken.nTokenAddress(currencyId) == tokenAddress
        (currencyIdStored, incentives, lastInitializeTime, parameters) = nToken.getNTokenContext(
            tokenAddress
        )
        assert currencyIdStored == currencyId
        assert incentives == 0
        assert lastInitializeTime == 0
        assert parameters == "0x00000000000000"

        nToken.setIncentiveEmissionRate(tokenAddress, 100_000)
        nToken.updateNTokenCollateralParameters(currencyId, 40, 90, 96, 50, 95)

        (currencyIdStored, incentives, lastInitializeTime, parameters) = nToken.getNTokenContext(
            tokenAddress
        )
        assert currencyIdStored == currencyId
        assert incentives == 100_000
        assert lastInitializeTime == 0
        assert bytearray(parameters)[0] == 95
        assert bytearray(parameters)[1] == 50
        assert bytearray(parameters)[2] == 96
        assert bytearray(parameters)[3] == 90
        assert bytearray(parameters)[4] == 40
        assert bytearray(parameters)[5] == 0

        nToken.setArrayLengthAndInitializedTime(tokenAddress, 5, START_TIME)

        (currencyIdStored, incentives, lastInitializeTime, parameters) = nToken.getNTokenContext(
            tokenAddress
        )
        assert currencyIdStored == currencyId
        assert incentives == 100_000
        assert lastInitializeTime == START_TIME
        assert bytearray(parameters)[0] == 95
        assert bytearray(parameters)[1] == 50
        assert bytearray(parameters)[2] == 96
        assert bytearray(parameters)[3] == 90
        assert bytearray(parameters)[4] == 40
        assert bytearray(parameters)[5] == 5

        nToken.updateNTokenCollateralParameters(currencyId, 41, 91, 97, 51, 96)
        (currencyIdStored, incentives, lastInitializeTime, parameters) = nToken.getNTokenContext(
            tokenAddress
        )
        assert currencyIdStored == currencyId
        assert incentives == 100_000
        assert lastInitializeTime == START_TIME
        assert bytearray(parameters)[0] == 96
        assert bytearray(parameters)[1] == 51
        assert bytearray(parameters)[2] == 97
        assert bytearray(parameters)[3] == 91
        assert bytearray(parameters)[4] == 41
        assert bytearray(parameters)[5] == 5

    def test_initialize_ntoken_supply(self, nToken, accounts):
        # When we initialize the nToken supply amount the integral token supply
        # should be set to zero and the total supply should be updated.
        tokenAddress = accounts[9]
        txn = nToken.changeNTokenSupply(tokenAddress, 100e8, START_TIME)
        assert txn.return_value == 0
        (
            totalSupply,
            integralTotalSupply,
            lastTotalSupplyChange,
        ) = nToken.getStoredNTokenSupplyFactors(tokenAddress)
        assert totalSupply == 100e8
        assert integralTotalSupply == 0
        assert lastTotalSupplyChange == START_TIME

    def test_increment_ntoken_supply(self, nToken, accounts):
        # Generate a random stream of increments and decrements
        # ensure that the integral total supply is correct. Calculate
        # the weighted average at the end.
        tokenAddress = accounts[9]
        nToken.changeNTokenSupply(tokenAddress, 100e8, START_TIME)
        updates = [random.randint(-1000, 1000) * 10e4 for i in range(0, 10)]

        blockTime = START_TIME
        integralValues = []
        timeDeltas = []
        totalSupplyValues = []
        for u in updates:
            timeDelta = random.randint(0, 86400)
            blockTime = blockTime + timeDelta
            txn = nToken.changeNTokenSupply(tokenAddress, u, blockTime)
            (
                totalSupply,
                integralTotalSupply,
                lastTotalSupplyChange,
            ) = nToken.getStoredNTokenSupplyFactors(tokenAddress)

            # If u == 0 then there will be no update
            if u != 0:
                integralValues.append(txn.return_value)
                timeDeltas.append(blockTime)
                totalSupplyValues.append(totalSupply)
                assert integralTotalSupply == txn.return_value
                assert lastTotalSupplyChange == blockTime

        # Pick a random time within the range of time deltas as the last claim time
        index = random.randint(0, 9)
        lastClaimTime = timeDeltas[index]
        lastClaimSupply = integralValues[index]
        txn = nToken.changeNTokenSupply(tokenAddress, 0, blockTime)

        # Actually calculate the weighted average
        weightedNumerator = 0
        weights = 0
        for i in range(index, 10):
            if i == index:
                continue

            weights += timeDeltas[i] - timeDeltas[i - 1]
            weightedNumerator += totalSupplyValues[i - 1] * (timeDeltas[i] - timeDeltas[i - 1])

        weights += blockTime - timeDeltas[i]
        weightedNumerator += totalSupplyValues[i] * (blockTime - timeDeltas[i])

        # Don't need to assert on the divided amount, just assert the numerator and denominator
        # match correctly
        # calculatedAvgSupply = (txn.return_value - lastClaimSupply) / (blockTime - lastClaimTime)
        assert weights == blockTime - lastClaimTime
        assert weightedNumerator == txn.return_value - lastClaimSupply

    def test_no_change_ntoken_supply(self, nToken, accounts):
        # Ensure that when no change to the token supply occurs there
        # will be no update to the supply amounts
        tokenAddress = accounts[9]
        nToken.changeNTokenSupply(tokenAddress, 100e8, START_TIME)

        txn = nToken.changeNTokenSupply(tokenAddress, 0, START_TIME + 20)
        # The returned integral token supply reflects the up to date value
        assert txn.return_value == (100e8 * 20)
        (
            totalSupply,
            integralTotalSupply,
            lastTotalSupplyChange,
        ) = nToken.getStoredNTokenSupplyFactors(tokenAddress)
        # The stored values have not changed
        assert totalSupply == 100e8
        assert integralTotalSupply == 0
        assert lastTotalSupplyChange == START_TIME

    def test_deposit_parameters_failures(self, nToken):
        with brownie.reverts("PT: deposit share length"):
            nToken.setDepositParameters(1, [1] * 10, [1] * 10)

        with brownie.reverts("PT: leverage share length"):
            nToken.setDepositParameters(1, [1] * 2, [1] * 10)

        with brownie.reverts("PT: leverage threshold"):
            nToken.setDepositParameters(1, [1] * 2, [0] * 2)

        with brownie.reverts("PT: leverage threshold"):
            nToken.setDepositParameters(1, [1] * 2, [1.1e9] * 2)

        with brownie.reverts("PT: deposit shares sum"):
            nToken.setDepositParameters(1, [1e8, 100], [100] * 2)

    @given(maxMarketIndex=strategy("uint", min_value=2, max_value=7))
    def test_deposit_parameters(self, nToken, maxMarketIndex):
        currencyId = 1
        randNums = [random.random() for i in range(0, maxMarketIndex)]
        basis = sum(randNums)
        depositShares = [math.trunc(r / basis * 1e7) for r in randNums]
        depositShares[0] = depositShares[0] + (1e8 - sum(depositShares))
        leverageThresholds = [random.randint(1e6, 1e7) for i in range(0, maxMarketIndex)]

        nToken.setDepositParameters(currencyId, depositShares, leverageThresholds)

        (storedDepositShares, storedLeverageThresholds) = nToken.getDepositParameters(
            currencyId, maxMarketIndex
        )
        assert storedDepositShares == depositShares
        assert storedLeverageThresholds == leverageThresholds

    def test_init_parameters_failures(self, nToken):
        with brownie.reverts("PT: annualized anchor rates length"):
            nToken.setInitializationParameters(1, [1] * 10, [1] * 10)

        with brownie.reverts("PT: proportions length"):
            nToken.setInitializationParameters(1, [1] * 2, [1] * 10)

        with brownie.reverts("PT: invalid proportion"):
            nToken.setInitializationParameters(1, [1.1e9], [0])

        with brownie.reverts("PT: invalid proportion"):
            nToken.setInitializationParameters(1, [1.1e9], [1.1e9])

    @given(maxMarketIndex=strategy("uint", min_value=0, max_value=7))
    def test_init_parameters_values(self, nToken, maxMarketIndex):
        currencyId = 1
        initialAnnualRates = [random.randint(0, 0.4e9) for i in range(0, maxMarketIndex)]
        proportions = [random.randint(0.75e9, 0.999e9) for i in range(0, maxMarketIndex)]

        nToken.setInitializationParameters(currencyId, initialAnnualRates, proportions)

        (storedRateAnchors, storedProportions) = nToken.getInitializationParameters(
            currencyId, maxMarketIndex
        )
        assert storedRateAnchors == initialAnnualRates
        assert storedProportions == proportions
