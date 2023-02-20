// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;
import "@pooltogether/owner-manager-contracts/contracts/Manageable.sol";
import "./interfaces/IPrizeTierHistory.sol";
import "./libraries/BinarySearchLib.sol";

/**
 * @title  PoolTogether V4 PrizeTierHistory
 * @author PoolTogether Inc Team
 * @notice The PrizeTierHistory smart contract stores a history of PrizeTier structs linked to
           a range of valid Draw IDs.
 * @dev    If the history param has single PrizeTier struct with a "drawId" of 1 all subsequent
           Draws will use that PrizeTier struct for PrizeDitribution calculations. The BinarySearchLib
           will find a PrizeTier using a "atOrBefore" range search when supplied drawId input parameter.
 */
contract PrizeTierHistory is IPrizeTierHistory, Manageable {
    // @dev The uint32[] type is extended with a binarySearch(uint32) function.
    using BinarySearchLib for uint32[];

    /**
     * @notice Ordered array of Draw IDs
     * @dev The history, with sequentially ordered ids, can be searched using binary search.
            The binary search will find index of a drawId (atOrBefore) using a specific drawId (at).
            When a new Draw ID is added to the history, a corresponding mapping of the ID is
            updated in the prizeTiers mapping.
    */
    uint32[] internal history;

    /**
     * @notice Mapping a Draw ID to a PrizeTier struct.
     * @dev The prizeTiers mapping links a Draw ID to a PrizeTier struct.
            The prizeTiers mapping is updated when a new Draw ID is added to the history.
    */
    mapping(uint32 => PrizeTier) internal prizeTiers;

    /**
     * @notice Ceiling for the total sum of tiers from the prize distribution. 1e9 = 100%.
     * @dev It's fixed point 9 because 1e9 is the largest "1" that fits into 2**32
     */
    uint256 internal constant TIERS_CEILING = 1e9;

    constructor(address owner) Ownable(owner) {}

    // @inheritdoc IPrizeTierHistory
    function count() external view override returns (uint256) {
        return history.length;
    }

    // @inheritdoc IPrizeTierHistory
    function getOldestDrawId() external view override returns (uint32) {
        return history[0];
    }

    // @inheritdoc IPrizeTierHistory
    function getNewestDrawId() external view override returns (uint32) {
        return history[history.length - 1];
    }

    // @inheritdoc IPrizeTierHistory
    function getPrizeTier(uint32 drawId) external view override returns (PrizeTier memory) {
        require(drawId > 0, "PrizeTierHistory/draw-id-not-zero");
        return prizeTiers[history.binarySearch(drawId)];
    }

    // @inheritdoc IPrizeTierHistory
    function getPrizeTierList(uint32[] calldata _drawIds)
        external
        view
        override
        returns (PrizeTier[] memory)
    {
        uint256 _length = _drawIds.length;
        PrizeTier[] memory _data = new PrizeTier[](_length);
        for (uint256 index = 0; index < _length; index++) {
            _data[index] = prizeTiers[history.binarySearch(_drawIds[index])];
        }
        return _data;
    }

    // @inheritdoc IPrizeTierHistory
    function getPrizeTierAtIndex(uint256 index) external view override returns (PrizeTier memory) {
        return prizeTiers[uint32(index)];
    }

    // @inheritdoc IPrizeTierHistory
    function push(PrizeTier calldata nextPrizeTier) external override onlyManagerOrOwner {
        _push(nextPrizeTier);
    }

    // @inheritdoc IPrizeTierHistory
    function popAndPush(PrizeTier calldata newPrizeTier)
        external
        override
        onlyOwner
        returns (uint32)
    {
        uint256 length = history.length;
        require(length > 0, "PrizeTierHistory/history-empty");
        require(history[length - 1] == newPrizeTier.drawId, "PrizeTierHistory/invalid-draw-id");
        _replace(newPrizeTier);
        return newPrizeTier.drawId;
    }

    // @inheritdoc IPrizeTierHistory
    function replace(PrizeTier calldata newPrizeTier) external override onlyOwner {
        _replace(newPrizeTier);
    }

    /**
     * @notice Check that the total sum of the tiers is not greater than 1e9 (100%).
     * @param  _tiers Array of tiers to check
     */
    function _checkTiersTotalSum(uint32[16] memory _tiers) internal pure {
        uint256 tiersTotalSum;
        uint256 tiersLength = _tiers.length;

        for (uint256 index; index < tiersLength; index++) {
            tiersTotalSum += _tiers[index];
        }

        require(tiersTotalSum <= TIERS_CEILING, "PrizeTierHistory/tiers-gt-100%");
    }

    /**
     * @notice Push PrizeTier struct onto `prizeTiers` array.
     * @dev Callable only by the owner or manager.
     * @dev `drawId` must be greater than the latest one stored in `history`.
     * @param _prizeTier Next PrizeTier struct
     */
    function _push(PrizeTier memory _prizeTier) internal {
        uint32 _length = uint32(history.length);

        if (_length > 0) {
            uint32 _id = history[_length - 1];
            require(_prizeTier.drawId > _id, "PrizeTierHistory/non-sequential-id");
        }

        _checkTiersTotalSum(_prizeTier.tiers);

        history.push(_prizeTier.drawId);
        prizeTiers[_length] = _prizeTier;

        emit PrizeTierPushed(_prizeTier.drawId, _prizeTier);
    }

    /**
     * @notice Replace PrizeTier struct in `prizeTiers` array.
     * @dev Callable only by the owner.
     * @param _prizeTier PrizeTier parameters
     */
    function _replace(PrizeTier calldata _prizeTier) internal {
        uint256 cardinality = history.length;
        require(cardinality > 0, "PrizeTierHistory/no-prize-tiers");

        uint32 oldestDrawId = history[0];
        require(_prizeTier.drawId >= oldestDrawId, "PrizeTierHistory/draw-id-out-of-range");

        uint32 index = history.binarySearch(_prizeTier.drawId);
        require(history[index] == _prizeTier.drawId, "PrizeTierHistory/draw-id-must-match");

        _checkTiersTotalSum(_prizeTier.tiers);

        prizeTiers[index] = _prizeTier;

        emit PrizeTierSet(_prizeTier.drawId, _prizeTier);
    }
}
