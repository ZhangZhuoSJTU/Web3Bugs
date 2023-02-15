pragma solidity ^0.5.11;

import "./mocks/EarningsPoolFixture.sol";
import "./helpers/truffle/Assert.sol";

contract TestEarningsPool {
    EarningsPoolFixture fixture;

    function beforeEach() public {
        fixture = new EarningsPoolFixture();
        fixture.setStake(1000);
        fixture.setCommission(500000, 500000);
        fixture.setHasTranscoderRewardFeePool(true);
    }

    function test_setCommission() public {
        fixture.setCommission(5, 10);
        (, , , , , , , uint256 transcoderRewardCut, uint256 transcoderFeeShare) = fixture.getEarningsPool();
        Assert.equal(transcoderRewardCut, 5, "wrong transcoderRewardCut");
        Assert.equal(transcoderFeeShare, 10, "wrong transcoderFeeShare");
    }

    function test_setStake() public {
        fixture.setStake(5000);
        (, , , , , uint256 totalStake, , , ) = fixture.getEarningsPool();
        Assert.equal(totalStake, 5000, "wrong totalStake");
    }

    function test_addToFeePool() public {
        fixture.addToFeePool(1000);
        Assert.equal(fixture.getFeePool(), 500, "should put portion of fees in delegator fee pool");
        Assert.equal(fixture.getTranscoderFeePool(), 500, "should put portion of fees in transcoder fee pool");
    }

    function test_addToFeePool_zero() public {
        fixture.addToFeePool(0);
        Assert.equal(fixture.getFeePool(), 0, "should put 0 fees in delegator fee pool");
        Assert.equal(fixture.getTranscoderFeePool(), 0, "should put 0 fees in transcoder fee pool");
    }

    function test_addToFeePool_noDelegatorFees() public {
        // feeShare = 0% - no delegator fees
        fixture.setCommission(500000, 0);
        fixture.addToFeePool(1000);
        Assert.equal(fixture.getFeePool(), 0, "should put 0 fees in delegator fee pool");
        Assert.equal(fixture.getTranscoderFeePool(), 1000, "should put all fees in transcoder fee pool");
    }

    function test_addToFeePool_noTranscoderFees() public {
        // feeShare = 100% - no transcoder fees
        fixture.setCommission(500000, 1000000);
        fixture.addToFeePool(1000);
        Assert.equal(fixture.getFeePool(), 1000, "should put all fees in delegator fee pool");
        Assert.equal(fixture.getTranscoderFeePool(), 0, "should put 0 fees in transcoder fee pool");
    }

    function test_addToRewardPool() public {
        fixture.addToRewardPool(1000);
        Assert.equal(fixture.getRewardPool(), 500, "should put portion of rewards in delegator reward pool");
        Assert.equal(fixture.getTranscoderRewardPool(), 500, "should put portion of rewards in transcoder reward pool");
    }

    function test_addToRewardPool_zero() public {
        fixture.addToRewardPool(0);
        Assert.equal(fixture.getRewardPool(), 0, "should put 0 rewards in delegator reward pool");
        Assert.equal(fixture.getTranscoderRewardPool(), 0, "should put 0 rewards in transcoder reward pool");
    }

    function test_addToRewardPool_noDelegatorRewards() public {
        // rewardCut = 100% - no delegator rewards
        fixture.setCommission(1000000, 500000);
        fixture.addToRewardPool(1000);
        Assert.equal(fixture.getRewardPool(), 0, "should put 0 rewards in delegator reward pool");
        Assert.equal(fixture.getTranscoderRewardPool(), 1000, "should put all rewards in transcoder reward pool");
    }

    function test_addToRewardPool_noRewards() public {
        // rewardCut = 0% - no transcoder rewards
        fixture.setCommission(0, 500000);
        fixture.addToRewardPool(1000);
        Assert.equal(fixture.getRewardPool(), 1000, "should put all rewards in delegator reward pool");
        Assert.equal(fixture.getTranscoderRewardPool(), 0, "should put 0 rewards in transcoder reward pool");
    }
}
