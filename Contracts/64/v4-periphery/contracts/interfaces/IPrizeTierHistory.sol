// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;
import "@pooltogether/v4-core/contracts/DrawBeacon.sol";

/**
 * @title  PoolTogether V4 IPrizeTierHistory
 * @author PoolTogether Inc Team
 * @notice IPrizeTierHistory is the base contract for PrizeTierHistory
 */
interface IPrizeTierHistory {
    /// @notice Linked Draw and PrizeDistribution parameters storage schema
    struct PrizeTier {
        uint8 bitRangeSize;
        uint32 drawId;
        uint32 maxPicksPerUser;
        uint32 expiryDuration;
        uint32 endTimestampOffset;
        uint256 prize;
        uint32[16] tiers;
    }

    /**
     * @notice Emitted when new PrizeTier is added to history
     * @param drawId    Draw ID
     * @param prizeTier PrizeTier parameters
     */
    event PrizeTierPushed(uint32 indexed drawId, PrizeTier prizeTier);

    /**
     * @notice Emitted when existing PrizeTier is updated in history
     * @param drawId    Draw ID
     * @param prizeTier PrizeTier parameters
     */
    event PrizeTierSet(uint32 indexed drawId, PrizeTier prizeTier);

    /**
     * @notice Push PrizeTier struct onto `prizeTiers` array.
     * @dev Callable only by the owner or manager.
     * @dev `drawId` must be greater than the latest one stored in `history`.
     * @param nextPrizeTier Next PrizeTier struct
     */
    function push(PrizeTier calldata nextPrizeTier) external;

    /**
     * @notice Replace PrizeTier struct in `prizeTiers` array.
     * @dev    Callable only by the owner.
     * @param newPrizeTier PrizeTier parameters
     */
    function replace(PrizeTier calldata newPrizeTier) external;

    /**
     * @notice Pop the latest prize tier stored in the `prizeTiers` array and replace it with the new prize tier.
     * @dev    Callable only by the owner.
     * @param newPrizeTier Updated PrizeTier struct
     * @return drawId Draw ID of the PrizeTier that was pushed
     */
    function popAndPush(PrizeTier calldata newPrizeTier) external returns (uint32 drawId);

    /**
     * @notice Returns the number of Prize Tier structs pushed.
     * @return The number of prize tiers that have been pushed
     */
    function count() external view returns (uint256);

    /**
     * @notice Read PrizeTierHistory struct from history array.
     * @param drawId Draw ID
     * @return prizeTier
     */
    function getPrizeTier(uint32 drawId) external view returns (PrizeTier memory prizeTier);

    /**
     * @notice Read PrizeTierHistory List from history array.
     * @param drawIds Draw ID array
     * @return prizeTierList
     */
    function getPrizeTierList(uint32[] calldata drawIds)
        external
        view
        returns (PrizeTier[] memory prizeTierList);

    /**
     * @notice Get prize tier at the specified `index`.
     * @param index Index at which to get the prize tier
     * @return PrizeTier at `index`
     */
    function getPrizeTierAtIndex(uint256 index) external view returns (PrizeTier memory);

    /**
     * @notice Read first Draw ID used to initialize history.
     * @return Draw ID of first PrizeTier record
     */
    function getOldestDrawId() external view returns (uint32);

    /**
     * @notice Read last Draw ID stored in the history.
     * @return Draw ID of the last recorded PrizeTier record
     */
    function getNewestDrawId() external view returns (uint32);
}
