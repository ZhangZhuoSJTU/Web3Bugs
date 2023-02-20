// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@pooltogether/v4-core/contracts/DrawBeacon.sol";

/**
 * @title  PoolTogether V4 IPrizeTierHistoryV2
 * @author PoolTogether Inc Team
 * @notice IPrizeTierHistoryV2 is the base contract for PrizeTierHistoryV2
 */
interface IPrizeTierHistoryV2 {
    /**
     * @notice PrizeTierV2 struct
     * @dev    Adds Draw Percentage Rate (DPR) parameter to PrizeTier struct
     */
    struct PrizeTierV2 {
        uint8 bitRangeSize;
        uint32 drawId;
        uint32 maxPicksPerUser;
        uint32 expiryDuration;
        uint32 endTimestampOffset;
        uint32 dpr;
        uint256 prize;
        uint32[16] tiers;
    }

    /**
     * @notice Emit when new PrizeTierV2 is added to history
     * @param drawId    Draw ID
     * @param prizeTier PrizeTierV2 parameters
     */
    event PrizeTierPushed(uint32 indexed drawId, PrizeTierV2 prizeTier);

    /**
     * @notice Emitted when existing PrizeTierV2 is updated in history
     * @param drawId    Draw ID
     * @param prizeTier PrizeTierV2 parameters
     */
    event PrizeTierSet(uint32 indexed drawId, PrizeTierV2 prizeTier);

    /**
     * @notice Push PrizeTierV2 struct onto `prizeTiers` array.
     * @dev Callable only by the owner or manager.
     * @dev `drawId` must be greater than the latest one stored in `history`.
     * @param nextPrizeTier Next PrizeTierV2 struct
     */
    function push(PrizeTierV2 calldata nextPrizeTier) external;

    /**
     * @notice Replace PrizeTierV2 struct in `prizeTiers` array.
     * @dev    Callable only by the owner.
     * @param newPrizeTier PrizeTierV2 parameters
     */
    function replace(PrizeTierV2 calldata newPrizeTier) external;

    /**
     * @notice Pop the latest prize tier stored in the `prizeTiers` array and replace it with the new prize tier.
     * @dev    Callable only by the owner.
     * @param newPrizeTier Updated PrizeTierV2 struct
     * @return drawId Draw ID of the PrizeTierV2 that was pushed
     */
    function popAndPush(PrizeTierV2 calldata newPrizeTier) external returns (uint32 drawId);

    /**
     * @notice Returns the number of Prize Tier structs pushed
     * @return The number of prize tiers that have been pushed
     */
    function count() external view returns (uint256);

    /**
     * @notice Read PrizeTierHistory struct from history array.
     * @param drawId Draw ID
     * @return prizeTier
     */
    function getPrizeTier(uint32 drawId) external view returns (PrizeTierV2 memory prizeTier);

    /**
     * @notice Read PrizeTierV2 struct using Draw ID as the input
     * @param drawIds Draw ID
     * @return prizeTierList PrizeTierV2[] - Parameters to calculate PrizeDistrubtion
     */
    function getPrizeTierList(uint32[] calldata drawIds)
        external
        view
        returns (PrizeTierV2[] memory prizeTierList);

    /**
     * @notice Get prize tier at the specified `index`.
     * @param index Index at which to get the prize tier
     * @return PrizeTier at `index`
     */
    function getPrizeTierAtIndex(uint256 index) external view returns (PrizeTierV2 memory);

    /**
     * @notice Read first Draw ID used to initialize history
     * @return Draw ID of first PrizeTierV2 record
     */
    function getOldestDrawId() external view returns (uint32);

    /**
     * @notice Read last Draw ID stored in the history.
     * @return Draw ID of the last recorded PrizeTier record
     */
    function getNewestDrawId() external view returns (uint32);
}
