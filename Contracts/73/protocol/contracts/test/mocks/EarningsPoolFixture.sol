pragma solidity ^0.5.11;

import "../../libraries/MathUtils.sol";
import "../../bonding/libraries/EarningsPool.sol";
import "../../bonding/libraries/EarningsPoolLIP36.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract EarningsPoolFixture {
    using SafeMath for uint256;
    using EarningsPool for EarningsPool.Data;
    using EarningsPoolLIP36 for EarningsPool.Data;

    EarningsPool.Data prevPool;
    EarningsPool.Data pool;

    function setCommission(uint256 _rewardCut, uint256 _feeShare) public {
        pool.setCommission(_rewardCut, _feeShare);
    }

    function setStake(uint256 _stake) public {
        pool.setStake(_stake);
    }

    function setClaimableStake(uint256 _stake) public {
        pool.claimableStake = _stake;
    }

    function setHasTranscoderRewardFeePool(bool _hasTranscoderRewardFeePool) public {
        pool.hasTranscoderRewardFeePool = _hasTranscoderRewardFeePool;
    }

    // addToFeePool() has been removed from EarningsPool.sol but its logic is implemented here because
    // it is still useful for tests (see EarningsPoolPreLIP36.sol for the original addToFeePool())
    function addToFeePool(uint256 _fees) public {
        if (pool.hasTranscoderRewardFeePool) {
            // If the earnings pool has a separate transcoder fee pool, calculate the portion of incoming fees
            // to put into the delegator fee pool and the portion to put into the transcoder fee pool
            uint256 delegatorFees = MathUtils.percOf(_fees, pool.transcoderFeeShare);
            pool.feePool = pool.feePool.add(delegatorFees);
            pool.transcoderFeePool = pool.transcoderFeePool.add(_fees.sub(delegatorFees));
        } else {
            // If the earnings pool does not have a separate transcoder fee pool, put all the fees into the delegator fee pool
            pool.feePool = pool.feePool.add(_fees);
        }
    }

    // addToRewardPool() has been removed from EarningsPool.sol but its logic is implemented here because
    // it is still useful for tests (see EarningsPoolPreLIP36.sol for the original addToRewardPool())
    function addToRewardPool(uint256 _rewards) public {
        if (pool.hasTranscoderRewardFeePool) {
            // If the earnings pool has a separate transcoder reward pool, calculate the portion of incoming rewards
            // to put into the delegator reward pool and the portion to put into the transcoder reward pool
            uint256 transcoderRewards = MathUtils.percOf(_rewards, pool.transcoderRewardCut);
            pool.rewardPool = pool.rewardPool.add(_rewards.sub(transcoderRewards));
            pool.transcoderRewardPool = pool.transcoderRewardPool.add(transcoderRewards);
        } else {
            // If the earnings pool does not have a separate transcoder reward pool, put all the rewards into the delegator reward pool
            pool.rewardPool = pool.rewardPool.add(_rewards);
        }
    }

    function updateCumulativeFeeFactor(uint256 _fees) public {
        pool.updateCumulativeFeeFactor(prevPool, _fees);
    }

    function updateCumulativeRewardFactor(uint256 _rewards) public {
        pool.updateCumulativeRewardFactor(prevPool, _rewards);
    }

    function setPrevPoolEarningsFactors(uint256 _cumulativeFeeFactor, uint256 _cumulativeRewardFactor) public {
        prevPool.cumulativeFeeFactor = _cumulativeFeeFactor;
        prevPool.cumulativeRewardFactor = _cumulativeRewardFactor;
    }

    function hasClaimableShares() public view returns (bool) {
        return pool.hasClaimableShares();
    }

    function feePoolShare(uint256 _stake, bool _isTranscoder) public view returns (uint256) {
        return pool.feePoolShare(_stake, _isTranscoder);
    }

    function rewardPoolShare(uint256 _stake, bool _isTranscoder) public view returns (uint256) {
        return pool.rewardPoolShare(_stake, _isTranscoder);
    }

    function getEarningsPool()
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            bool,
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return (
            pool.rewardPool,
            pool.feePool,
            pool.transcoderRewardPool,
            pool.transcoderFeePool,
            pool.hasTranscoderRewardFeePool,
            pool.totalStake,
            pool.claimableStake,
            pool.transcoderRewardCut,
            pool.transcoderFeeShare
        );
    }

    function getRewardPool() public view returns (uint256) {
        return pool.rewardPool;
    }

    function getFeePool() public view returns (uint256) {
        return pool.feePool;
    }

    function getTranscoderRewardPool() public view returns (uint256) {
        return pool.transcoderRewardPool;
    }

    function getTranscoderFeePool() public view returns (uint256) {
        return pool.transcoderFeePool;
    }

    function getHasTranscoderRewardFeePool() public view returns (bool) {
        return pool.hasTranscoderRewardFeePool;
    }

    function getClaimableStake() public view returns (uint256) {
        return pool.claimableStake;
    }

    function getTotalStake() public view returns (uint256) {
        return pool.totalStake;
    }

    function getCumulativeRewardFactor() public view returns (uint256) {
        return pool.cumulativeRewardFactor;
    }

    function getCumulativeFeeFactor() public view returns (uint256) {
        return pool.cumulativeFeeFactor;
    }
}
