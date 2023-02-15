pragma solidity ^0.5.11;

import "./mocks/EarningsPoolFixture.sol";
import "./helpers/truffle/Assert.sol";
import "../libraries/PreciseMathUtils.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract TestEarningsPoolLIP36 {
    using SafeMath for uint256;

    EarningsPoolFixture fixture;

    function beforeEach() public {
        fixture = new EarningsPoolFixture();
        fixture.setStake(1000);
        fixture.setCommission(500000, 500000);
    }

    function test_updateCumulativeFeeFactor_no_prevEarningsPool() public {
        uint256 fees = 1000;

        // earningsPool.cumulativeFeeFactor == 0
        // prevEarningsPool.cumulativeFeeFactor == 0
        // prevEarningsPool.cumulativeRewardFactor == 0
        fixture.updateCumulativeFeeFactor(fees);
        uint256 expFeeFactor = PreciseMathUtils.percPoints(fees, fixture.getTotalStake());
        Assert.equal(fixture.getCumulativeFeeFactor(), expFeeFactor, "should set cumulativeFeeFactor");

        // earningsPool.cumulativeFeeFactor != 0
        fixture.updateCumulativeFeeFactor(fees);
        expFeeFactor = expFeeFactor.add(PreciseMathUtils.percPoints(fees, fixture.getTotalStake()));
        Assert.equal(fixture.getCumulativeFeeFactor(), expFeeFactor, "should update cumulativeFeeFactor");
    }

    function test_updateCumulativeFeeFactor_prevEarningsPool() public {
        uint256 fees = 200;

        // prevEarningsPool.cumulativeFeeFactor = 2
        // prevEarningsPool.cumulativeRewardFactor = 3
        uint256 prevFeeFactor = 2;
        uint256 prevRewFactor = 3;
        fixture.setPrevPoolEarningsFactors(prevFeeFactor, prevRewFactor);

        // earningsPool.cumulativeFeeFactor == 0
        fixture.updateCumulativeFeeFactor(fees);
        uint256 expFeeFactor = prevFeeFactor.add(PreciseMathUtils.percOf(prevRewFactor, fees, fixture.getTotalStake()));
        Assert.equal(fixture.getCumulativeFeeFactor(), expFeeFactor, "should update cumulativeFeeFactor");

        // earningsPool.cumulativeFeeFactor != 0
        fixture.updateCumulativeFeeFactor(fees);
        expFeeFactor = expFeeFactor.add(PreciseMathUtils.percOf(prevRewFactor, fees, fixture.getTotalStake()));
    }

    function test_updateCumulativeRewardFactor() public {
        uint256 rewards = 1000;

        // prevEarningsPool.cumulativeRewardFactor == 0
        uint256 expRewardFactor = PreciseMathUtils.percPoints(1, 1).add(
            PreciseMathUtils.percOf(PreciseMathUtils.percPoints(1, 1), rewards, fixture.getTotalStake())
        );
        fixture.updateCumulativeRewardFactor(1000);
        Assert.equal(expRewardFactor, fixture.getCumulativeRewardFactor(), "incorrect cumulative reward factor");

        // prevEarningsPool.cumulativeRewardFactor != 0
        fixture.setPrevPoolEarningsFactors(0, expRewardFactor);
        expRewardFactor = expRewardFactor.add(
            PreciseMathUtils.percOf(expRewardFactor, rewards, fixture.getTotalStake())
        );
        fixture.updateCumulativeRewardFactor(1000);
        Assert.equal(expRewardFactor, fixture.getCumulativeRewardFactor(), "incorrect cumulative reward factor");
    }
}
