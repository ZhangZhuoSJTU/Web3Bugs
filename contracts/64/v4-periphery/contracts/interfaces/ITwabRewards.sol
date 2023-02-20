// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title  PoolTogether V4 ITwabRewards
 * @author PoolTogether Inc Team
 * @notice TwabRewards contract interface.
 */
interface ITwabRewards {
    /**
     * @notice Struct to keep track of each promotion's settings.
     * @param creator Addresss of the promotion creator
     * @param startTimestamp Timestamp at which the promotion starts
     * @param numberOfEpochs Number of epochs the promotion will last for
     * @param epochDuration Duration of one epoch in seconds
     * @param createdAt Timestamp at which the promotion was created
     * @param token Address of the token to be distributed as reward
     * @param tokensPerEpoch Number of tokens to be distributed per epoch
     * @param rewardsUnclaimed Amount of rewards that have not been claimed yet
     */
    struct Promotion {
        address creator;
        uint64 startTimestamp;
        uint8 numberOfEpochs;
        uint48 epochDuration;
        uint48 createdAt;
        IERC20 token;
        uint256 tokensPerEpoch;
        uint256 rewardsUnclaimed;
    }

    /**
     * @notice Creates a new promotion.
     * @dev For sake of simplicity, `msg.sender` will be the creator of the promotion.
     * @dev `_latestPromotionId` starts at 0 and is incremented by 1 for each new promotion.
     * So the first promotion will have id 1, the second 2, etc.
     * @dev The transaction will revert if the amount of reward tokens provided is not equal to `_tokensPerEpoch * _numberOfEpochs`.
     * This scenario could happen if the token supplied is a fee on transfer one.
     * @param _token Address of the token to be distributed
     * @param _startTimestamp Timestamp at which the promotion starts
     * @param _tokensPerEpoch Number of tokens to be distributed per epoch
     * @param _epochDuration Duration of one epoch in seconds
     * @param _numberOfEpochs Number of epochs the promotion will last for
     * @return Id of the newly created promotion
     */
    function createPromotion(
        IERC20 _token,
        uint64 _startTimestamp,
        uint256 _tokensPerEpoch,
        uint48 _epochDuration,
        uint8 _numberOfEpochs
    ) external returns (uint256);

    /**
     * @notice End currently active promotion and send promotion tokens back to the creator.
     * @dev Will only send back tokens from the epochs that have not completed.
     * @param _promotionId Promotion id to end
     * @param _to Address that will receive the remaining tokens if there are any left
     * @return true if operation was successful
     */
    function endPromotion(uint256 _promotionId, address _to) external returns (bool);

    /**
     * @notice Delete an inactive promotion and send promotion tokens back to the creator.
     * @dev Will send back all the tokens that have not been claimed yet by users.
     * @dev This function will revert if the promotion is still active.
     * @dev This function will revert if the grace period is not over yet.
     * @param _promotionId Promotion id to destroy
     * @param _to Address that will receive the remaining tokens if there are any left
     * @return True if operation was successful
     */
    function destroyPromotion(uint256 _promotionId, address _to) external returns (bool);

    /**
     * @notice Extend promotion by adding more epochs.
     * @param _promotionId Id of the promotion to extend
     * @param _numberOfEpochs Number of epochs to add
     * @return True if the operation was successful
     */
    function extendPromotion(uint256 _promotionId, uint8 _numberOfEpochs) external returns (bool);

    /**
     * @notice Claim rewards for a given promotion and epoch.
     * @dev Rewards can be claimed on behalf of a user.
     * @dev Rewards can only be claimed for a past epoch.
     * @param _user Address of the user to claim rewards for
     * @param _promotionId Id of the promotion to claim rewards for
     * @param _epochIds Epoch ids to claim rewards for
     * @return Total amount of rewards claimed
     */
    function claimRewards(
        address _user,
        uint256 _promotionId,
        uint8[] calldata _epochIds
    ) external returns (uint256);

    /**
     * @notice Get settings for a specific promotion.
     * @param _promotionId Id of the promotion to get settings for
     * @return Promotion settings
     */
    function getPromotion(uint256 _promotionId) external view returns (Promotion memory);

    /**
     * @notice Get the current epoch id of a promotion.
     * @dev Epoch ids and their boolean values are tightly packed and stored in a uint256, so epoch id starts at 0.
     * @param _promotionId Id of the promotion to get current epoch for
     * @return Current epoch id of the promotion
     */
    function getCurrentEpochId(uint256 _promotionId) external view returns (uint256);

    /**
     * @notice Get the total amount of tokens left to be rewarded.
     * @param _promotionId Id of the promotion to get the total amount of tokens left to be rewarded for
     * @return Amount of tokens left to be rewarded
     */
    function getRemainingRewards(uint256 _promotionId) external view returns (uint256);

    /**
     * @notice Get amount of tokens to be rewarded for a given epoch.
     * @dev Rewards amount can only be retrieved for epochs that are over.
     * @dev Will revert if `_epochId` is over the total number of epochs or if epoch is not over.
     * @dev Will return 0 if the user average balance of tickets is 0.
     * @dev Will be 0 if user has already claimed rewards for the epoch.
     * @param _user Address of the user to get amount of rewards for
     * @param _promotionId Id of the promotion from which the epoch is
     * @param _epochIds Epoch ids to get reward amount for
     * @return Amount of tokens per epoch to be rewarded
     */
    function getRewardsAmount(
        address _user,
        uint256 _promotionId,
        uint8[] calldata _epochIds
    ) external view returns (uint256[] memory);
}
