pragma solidity ^0.5.11;

import "../../libraries/MathUtils.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title EarningsPool
 * @dev Manages reward and fee pools for delegators and transcoders
 */
library EarningsPool {
    using SafeMath for uint256;

    // Represents rewards and fees to be distributed to delegators
    // The `hasTranscoderRewardFeePool` flag was introduced so that EarningsPool.Data structs used by the BondingManager
    // created with older versions of this library can be differentiated from EarningsPool.Data structs used by the BondingManager
    // created with a newer version of this library. If the flag is true, then the struct was initialized using the `init` function
    // using a newer version of this library meaning that it is using separate transcoder reward and fee pools
    struct Data {
        uint256 rewardPool; // Delegator rewards. If `hasTranscoderRewardFeePool` is false, this will contain transcoder rewards as well
        uint256 feePool; // Delegator fees. If `hasTranscoderRewardFeePool` is false, this will contain transcoder fees as well
        uint256 totalStake; // Transcoder's total stake during the earnings pool's round
        uint256 claimableStake; // Stake that can be used to claim portions of the fee and reward pools
        uint256 transcoderRewardCut; // Transcoder's reward cut during the earnings pool's round
        uint256 transcoderFeeShare; // Transcoder's fee share during the earnings pool's round
        uint256 transcoderRewardPool; // Transcoder rewards. If `hasTranscoderRewardFeePool` is false, this should always be 0
        uint256 transcoderFeePool; // Transcoder fees. If `hasTranscoderRewardFeePool` is false, this should always be 0
        bool hasTranscoderRewardFeePool; // Flag to indicate if the earnings pool has separate transcoder reward and fee pools
    }

    /**
     * @dev Sets transcoderRewardCut and transcoderFeeshare for an EarningsPool
     * @param earningsPool Storage pointer to EarningsPool struct
     * @param _rewardCut Reward cut of transcoder during the earnings pool's round
     * @param _feeShare Fee share of transcoder during the earnings pool's round
     */
    function setCommission(
        EarningsPool.Data storage earningsPool,
        uint256 _rewardCut,
        uint256 _feeShare
    ) internal {
        earningsPool.transcoderRewardCut = _rewardCut;
        earningsPool.transcoderFeeShare = _feeShare;
        // We set this flag to true here to differentiate between EarningsPool structs created using older versions of this library.
        // When using a version of this library after the introduction of this flag to read an EarningsPool struct created using an older version
        // of this library, this flag should be false in the returned struct because the default value for EVM storage is 0
        earningsPool.hasTranscoderRewardFeePool = true;
    }

    /**
     * @dev Sets totalStake and claimableStake for an EarningsPool
     * @param earningsPool Storage pointer to EarningsPool struct
     * @param _stake Total stake of the transcoder during the earnings pool's round
     */
    function setStake(EarningsPool.Data storage earningsPool, uint256 _stake) internal {
        earningsPool.totalStake = _stake;
        earningsPool.claimableStake = _stake;
    }

    /**
     * @dev Return whether this earnings pool has claimable shares i.e. is there unclaimed stake
     * @param earningsPool Storage pointer to EarningsPool struct
     */
    function hasClaimableShares(EarningsPool.Data storage earningsPool) internal view returns (bool) {
        return earningsPool.claimableStake > 0;
    }

    /**
     * @dev Add fees to the earnings pool
     * @param earningsPool Storage pointer to EarningsPools struct
     * @param _fees Amount of fees to add
     */
    function addToFeePool(EarningsPool.Data storage earningsPool, uint256 _fees) internal {
        if (earningsPool.hasTranscoderRewardFeePool) {
            // If the earnings pool has a separate transcoder fee pool, calculate the portion of incoming fees
            // to put into the delegator fee pool and the portion to put into the transcoder fee pool
            uint256 delegatorFees = MathUtils.percOf(_fees, earningsPool.transcoderFeeShare);
            earningsPool.feePool = earningsPool.feePool.add(delegatorFees);
            earningsPool.transcoderFeePool = earningsPool.transcoderFeePool.add(_fees.sub(delegatorFees));
        } else {
            // If the earnings pool does not have a separate transcoder fee pool, put all the fees into the delegator fee pool
            earningsPool.feePool = earningsPool.feePool.add(_fees);
        }
    }

    /**
     * @dev Add rewards to the earnings pool
     * @param earningsPool Storage pointer to EarningsPool struct
     * @param _rewards Amount of rewards to add
     */
    function addToRewardPool(EarningsPool.Data storage earningsPool, uint256 _rewards) internal {
        if (earningsPool.hasTranscoderRewardFeePool) {
            // If the earnings pool has a separate transcoder reward pool, calculate the portion of incoming rewards
            // to put into the delegator reward pool and the portion to put into the transcoder reward pool
            uint256 transcoderRewards = MathUtils.percOf(_rewards, earningsPool.transcoderRewardCut);
            earningsPool.rewardPool = earningsPool.rewardPool.add(_rewards.sub(transcoderRewards));
            earningsPool.transcoderRewardPool = earningsPool.transcoderRewardPool.add(transcoderRewards);
        } else {
            // If the earnings pool does not have a separate transcoder reward pool, put all the rewards into the delegator reward pool
            earningsPool.rewardPool = earningsPool.rewardPool.add(_rewards);
        }
    }

    /**
     * @dev Claim reward and fee shares which decreases the reward/fee pools and the remaining claimable stake
     * @param earningsPool Storage pointer to EarningsPool struct
     * @param _stake Stake of claimant
     * @param _isTranscoder Flag indicating whether the claimant is a transcoder
     */
    function claimShare(
        EarningsPool.Data storage earningsPool,
        uint256 _stake,
        bool _isTranscoder
    ) internal returns (uint256, uint256) {
        uint256 totalFees = 0;
        uint256 totalRewards = 0;
        uint256 delegatorFees = 0;
        uint256 transcoderFees = 0;
        uint256 delegatorRewards = 0;
        uint256 transcoderRewards = 0;

        if (earningsPool.hasTranscoderRewardFeePool) {
            // EarningsPool has transcoder reward and fee pools
            // Compute fee share
            (delegatorFees, transcoderFees) = feePoolShareWithTranscoderRewardFeePool(
                earningsPool,
                _stake,
                _isTranscoder
            );
            totalFees = delegatorFees.add(transcoderFees);
            // Compute reward share
            (delegatorRewards, transcoderRewards) = rewardPoolShareWithTranscoderRewardFeePool(
                earningsPool,
                _stake,
                _isTranscoder
            );
            totalRewards = delegatorRewards.add(transcoderRewards);

            // Fee pool only holds delegator fees when `hasTranscoderRewardFeePool` is true - deduct delegator fees
            earningsPool.feePool = earningsPool.feePool.sub(delegatorFees);
            // Reward pool only holds delegator rewards when `hasTranscoderRewardFeePool` is true - deduct delegator rewards
            earningsPool.rewardPool = earningsPool.rewardPool.sub(delegatorRewards);

            if (_isTranscoder) {
                // Claiming as a transcoder
                // Clear transcoder fee pool
                earningsPool.transcoderFeePool = 0;
                // Clear transcoder reward pool
                earningsPool.transcoderRewardPool = 0;
            }
        } else {
            // EarningsPool does not have transcoder reward and fee pools
            // Compute fee share
            (delegatorFees, transcoderFees) = feePoolShareNoTranscoderRewardFeePool(
                earningsPool,
                _stake,
                _isTranscoder
            );
            totalFees = delegatorFees.add(transcoderFees);
            // Compute reward share
            (delegatorRewards, transcoderRewards) = rewardPoolShareNoTranscoderRewardFeePool(
                earningsPool,
                _stake,
                _isTranscoder
            );
            totalRewards = delegatorRewards.add(transcoderRewards);

            // Fee pool holds delegator and transcoder fees when `hasTranscoderRewardFeePool` is false - deduct delegator and transcoder fees
            earningsPool.feePool = earningsPool.feePool.sub(totalFees);
            // Reward pool holds delegator and transcoder fees when `hasTranscoderRewardFeePool` is false - deduct delegator and transcoder fees
            earningsPool.rewardPool = earningsPool.rewardPool.sub(totalRewards);
        }

        // Update remaining claimable stake
        earningsPool.claimableStake = earningsPool.claimableStake.sub(_stake);

        return (totalFees, totalRewards);
    }

    /**
     * @dev Returns the fee pool share for a claimant. If the claimant is a transcoder, include transcoder fees as well.
     * @param earningsPool Storage pointer to EarningsPool struct
     * @param _stake Stake of claimant
     * @param _isTranscoder Flag indicating whether the claimant is a transcoder
     */
    function feePoolShare(
        EarningsPool.Data storage earningsPool,
        uint256 _stake,
        bool _isTranscoder
    ) internal view returns (uint256) {
        uint256 delegatorFees = 0;
        uint256 transcoderFees = 0;

        if (earningsPool.hasTranscoderRewardFeePool) {
            (delegatorFees, transcoderFees) = feePoolShareWithTranscoderRewardFeePool(
                earningsPool,
                _stake,
                _isTranscoder
            );
        } else {
            (delegatorFees, transcoderFees) = feePoolShareNoTranscoderRewardFeePool(
                earningsPool,
                _stake,
                _isTranscoder
            );
        }

        return delegatorFees.add(transcoderFees);
    }

    /**
     * @dev Returns the reward pool share for a claimant. If the claimant is a transcoder, include transcoder rewards as well.
     * @param earningsPool Storage pointer to EarningsPool struct
     * @param _stake Stake of claimant
     * @param _isTranscoder Flag indicating whether the claimant is a transcoder
     */
    function rewardPoolShare(
        EarningsPool.Data storage earningsPool,
        uint256 _stake,
        bool _isTranscoder
    ) internal view returns (uint256) {
        uint256 delegatorRewards = 0;
        uint256 transcoderRewards = 0;

        if (earningsPool.hasTranscoderRewardFeePool) {
            (delegatorRewards, transcoderRewards) = rewardPoolShareWithTranscoderRewardFeePool(
                earningsPool,
                _stake,
                _isTranscoder
            );
        } else {
            (delegatorRewards, transcoderRewards) = rewardPoolShareNoTranscoderRewardFeePool(
                earningsPool,
                _stake,
                _isTranscoder
            );
        }

        return delegatorRewards.add(transcoderRewards);
    }

    /**
     * @dev Helper function to calculate fee pool share if the earnings pool has a separate transcoder fee pool
     * @param earningsPool Storage pointer to EarningsPool struct
     * @param _stake Stake of claimant
     * @param _isTranscoder Flag indicating whether the claimant is a transcoder
     */
    function feePoolShareWithTranscoderRewardFeePool(
        EarningsPool.Data storage earningsPool,
        uint256 _stake,
        bool _isTranscoder
    ) internal view returns (uint256, uint256) {
        // If there is no claimable stake, the fee pool share is 0
        // If there is claimable stake, calculate fee pool share based on remaining amount in fee pool, remaining claimable stake and claimant's stake
        uint256 delegatorFees = earningsPool.claimableStake > 0
            ? MathUtils.percOf(earningsPool.feePool, _stake, earningsPool.claimableStake)
            : 0;

        // If claimant is a transcoder, include transcoder fee pool as well
        return _isTranscoder ? (delegatorFees, earningsPool.transcoderFeePool) : (delegatorFees, 0);
    }

    /**
     * @dev Helper function to calculate reward pool share if the earnings pool has a separate transcoder reward pool
     * @param earningsPool Storage pointer to EarningsPool struct
     * @param _stake Stake of claimant
     * @param _isTranscoder Flag indicating whether the claimant is a transcoder
     */
    function rewardPoolShareWithTranscoderRewardFeePool(
        EarningsPool.Data storage earningsPool,
        uint256 _stake,
        bool _isTranscoder
    ) internal view returns (uint256, uint256) {
        // If there is no claimable stake, the reward pool share is 0
        // If there is claimable stake, calculate reward pool share based on remaining amount in reward pool, remaining claimable stake and claimant's stake
        uint256 delegatorRewards = earningsPool.claimableStake > 0
            ? MathUtils.percOf(earningsPool.rewardPool, _stake, earningsPool.claimableStake)
            : 0;

        // If claimant is a transcoder, include transcoder reward pool as well
        return _isTranscoder ? (delegatorRewards, earningsPool.transcoderRewardPool) : (delegatorRewards, 0);
    }

    /**
     * @dev Helper function to calculate the fee pool share if the earnings pool does not have a separate transcoder fee pool
     * This implements calculation logic from a previous version of this library
     * @param earningsPool Storage pointer to EarningsPool struct
     * @param _stake Stake of claimant
     * @param _isTranscoder Flag indicating whether the claimant is a transcoder
     */
    function feePoolShareNoTranscoderRewardFeePool(
        EarningsPool.Data storage earningsPool,
        uint256 _stake,
        bool _isTranscoder
    ) internal view returns (uint256, uint256) {
        uint256 transcoderFees = 0;
        uint256 delegatorFees = 0;

        if (earningsPool.claimableStake > 0) {
            uint256 delegatorsFees = MathUtils.percOf(earningsPool.feePool, earningsPool.transcoderFeeShare);
            transcoderFees = earningsPool.feePool.sub(delegatorsFees);
            delegatorFees = MathUtils.percOf(delegatorsFees, _stake, earningsPool.claimableStake);
        }

        if (_isTranscoder) {
            return (delegatorFees, transcoderFees);
        } else {
            return (delegatorFees, 0);
        }
    }

    /**
     * @dev Helper function to calculate the reward pool share if the earnings pool does not have a separate transcoder reward pool
     * This implements calculation logic from a previous version of this library
     * @param earningsPool Storage pointer to EarningsPool struct
     * @param _stake Stake of claimant
     * @param _isTranscoder Flag indicating whether the claimant is a transcoder
     */
    function rewardPoolShareNoTranscoderRewardFeePool(
        EarningsPool.Data storage earningsPool,
        uint256 _stake,
        bool _isTranscoder
    ) internal view returns (uint256, uint256) {
        uint256 transcoderRewards = 0;
        uint256 delegatorRewards = 0;

        if (earningsPool.claimableStake > 0) {
            transcoderRewards = MathUtils.percOf(earningsPool.rewardPool, earningsPool.transcoderRewardCut);
            delegatorRewards = MathUtils.percOf(
                earningsPool.rewardPool.sub(transcoderRewards),
                _stake,
                earningsPool.claimableStake
            );
        }

        if (_isTranscoder) {
            return (delegatorRewards, transcoderRewards);
        } else {
            return (delegatorRewards, 0);
        }
    }
}
