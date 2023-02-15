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
        @notice Struct to keep track of each promotion's settings.
        @param creator Addresss of the promotion creator
        @param ticket Prize Pool ticket address for which the promotion has been created
        @param token Address of the token to be distributed as reward
        @param tokensPerEpoch Number of tokens to be distributed per epoch
        @param startTimestamp Timestamp at which the promotion starts
        @param epochDuration Duration of one epoch in seconds
        @param numberOfEpochs Number of epochs the promotion will last for
     */
    struct Promotion {
        address creator;
        address ticket;
        IERC20 token;
        uint216 tokensPerEpoch;
        uint32 startTimestamp;
        uint32 epochDuration;
        uint8 numberOfEpochs;
    }

    /**
        @notice Create a new promotion.
        @dev For sake of simplicity, `msg.sender` will be the creator of the promotion.
        @dev `_latestPromotionId` starts at 0 and is incremented by 1 for each new promotion.
        So the first promotion will have id 1, the second 2, etc.
        @param _ticket Prize Pool ticket address for which the promotion is created
        @param _token Address of the token to be distributed
        @param _tokensPerEpoch Number of tokens to be distributed per epoch
        @param _startTimestamp Timestamp at which the promotion starts
        @param _epochDuration Duration of one epoch in seconds
        @param _numberOfEpochs Number of epochs the promotion will last for
        @return Id of the newly created promotion
    */
    function createPromotion(
        address _ticket,
        IERC20 _token,
        uint216 _tokensPerEpoch,
        uint32 _startTimestamp,
        uint32 _epochDuration,
        uint8 _numberOfEpochs
    ) external returns (uint256);

    /**
        @notice Cancel currently active promotion and send promotion tokens back to the creator.
        @param _promotionId Promotion id to cancel
        @param _to Address that will receive the remaining tokens if there are any left
        @return true if cancelation was successful
     */
    function cancelPromotion(uint256 _promotionId, address _to) external returns (bool);

    /**
        @notice Extend promotion by adding more epochs.
        @param _promotionId Promotion id to extend
        @param _numberOfEpochs Number of epochs to add
        @return true if the operation was successful
     */
    function extendPromotion(uint256 _promotionId, uint8 _numberOfEpochs) external returns (bool);

    /**
        @notice Claim rewards for a given promotion and epoch.
        @dev Rewards can be claimed on behalf of a user.
        @dev Rewards can only be claimed for a past epoch.
        @param _user Address of the user to claim rewards for
        @param _promotionId Promotion id to claim rewards for
        @param _epochIds Epoch ids to claim rewards for
        @return Amount of rewards claimed
     */
    function claimRewards(
        address _user,
        uint256 _promotionId,
        uint256[] calldata _epochIds
    ) external returns (uint256);

    /**
        @notice Get settings for a specific promotion.
        @param _promotionId Promotion id to get settings for
        @return Promotion settings
     */
    function getPromotion(uint256 _promotionId) external view returns (Promotion memory);

    /**
        @notice Get the current epoch id of a promotion.
        @dev Epoch ids and their boolean values are tightly packed and stored in a uint256, so epoch id starts at 0.
        @param _promotionId Promotion id to get current epoch for
        @return Epoch id
     */
    function getCurrentEpochId(uint256 _promotionId) external view returns (uint256);

    /**
        @notice Get the total amount of tokens left to be rewarded.
        @param _promotionId Promotion id to get the total amount of tokens left to be rewarded for
        @return Amount of tokens left to be rewarded
     */
    function getRemainingRewards(uint256 _promotionId) external view returns (uint256);

    /**
        @notice Get amount of tokens to be rewarded for a given epoch.
        @dev Will be 0 if user has already claimed rewards for the epoch.
        @param _user Address of the user to get amount of rewards for
        @param _promotionId Promotion id from which the epoch is
        @param _epochIds Epoch ids to get reward amount for
        @return Amount of tokens to be rewarded
     */
    function getRewardsAmount(
        address _user,
        uint256 _promotionId,
        uint256[] calldata _epochIds
    ) external view returns (uint256[] memory);
}
