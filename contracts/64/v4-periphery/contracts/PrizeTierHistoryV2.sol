// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@pooltogether/owner-manager-contracts/contracts/Manageable.sol";

import "./interfaces/IPrizeTierHistoryV2.sol";
import "./libraries/BinarySearchLib.sol";

/**
 * @title  PoolTogether V4 PrizeTierHistoryV2
 * @author PoolTogether Inc Team
 * @notice The PrizeTierHistoryV2 smart contract stores a history of PrizeTierV2 structs linked to
           a range of valid Draw IDs.
 * @dev    If the history param has single PrizeTierV2 struct with a "drawId" of 1 all subsequent
           Draws will use that PrizeTierV2 struct for PrizeDitribution calculations. The BinarySearchLib
           will find a PrizeTierV2 using a "atOrBefore" range search when supplied drawId input parameter.
 */
contract PrizeTierHistoryV2 is IPrizeTierHistoryV2, Manageable {
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
     * @notice Mapping a Draw ID to a PrizeTierV2 struct.
     * @dev The prizeTiers mapping links a Draw ID to a PrizeTierV2 struct.
            The prizeTiers mapping is updated when a new Draw ID is added to the history.
    */
    mapping(uint32 => PrizeTierV2) internal prizeTiers;

    /**
     * @notice Ceiling for the dpr and total sum of tiers from the prize distribution. 1e9 = 100%.
     * @dev It's fixed point 9 because 1e9 is the largest "1" that fits into 2**32
     */
    uint256 internal constant CEILING = 1e9;

    /**
     * @notice PrizeTierHistoryV2 constructor
     * @param _owner Address of the contract owner
     */
    constructor(address _owner) Ownable(_owner) {}

    // @inheritdoc IPrizeTierHistoryV2
    function count() external view override returns (uint256) {
        return history.length;
    }

    // @inheritdoc IPrizeTierHistoryV2
    function getOldestDrawId() external view override returns (uint32) {
        return history[0];
    }

    // @inheritdoc IPrizeTierHistoryV2
    function getNewestDrawId() external view override returns (uint32) {
        return history[history.length - 1];
    }

    // @inheritdoc IPrizeTierHistoryV2
    function getPrizeTier(uint32 drawId) external view override returns (PrizeTierV2 memory) {
        require(drawId > 0, "PTH/draw-id-not-zero");
        return prizeTiers[history.binarySearch(drawId)];
    }

    // @inheritdoc IPrizeTierHistoryV2
    function getPrizeTierList(uint32[] calldata _drawIds)
        external
        view
        override
        returns (PrizeTierV2[] memory)
    {
        uint256 _length = _drawIds.length;
        PrizeTierV2[] memory _data = new PrizeTierV2[](_length);
        for (uint256 index = 0; index < _length; index++) {
            _data[index] = prizeTiers[history.binarySearch(_drawIds[index])];
        }
        return _data;
    }

    // @inheritdoc IPrizeTierHistoryV2
    function getPrizeTierAtIndex(uint256 index)
        external
        view
        override
        returns (PrizeTierV2 memory)
    {
        return prizeTiers[uint32(index)];
    }

    // @inheritdoc IPrizeTierHistoryV2
    function push(PrizeTierV2 calldata nextPrizeTier) external override onlyManagerOrOwner {
        _push(nextPrizeTier);
    }

    // @inheritdoc IPrizeTierHistoryV2
    function popAndPush(PrizeTierV2 calldata newPrizeTier)
        external
        override
        onlyOwner
        returns (uint32)
    {
        uint256 length = history.length;
        require(length > 0, "PTH/history-empty");
        require(history[length - 1] == newPrizeTier.drawId, "PTH/invalid-draw-id");
        _replace(newPrizeTier);
        return newPrizeTier.drawId;
    }

    // @inheritdoc IPrizeTierHistoryV2
    function replace(PrizeTierV2 calldata newPrizeTier) external override onlyOwner {
        _replace(newPrizeTier);
    }

    /**
     * @notice Check that the Draw Percentage Rate (DPR) is not greater than 1e9 (100%).
     * @param  _dpr DPR to check
     */
    function _checkDPR(uint32 _dpr) internal pure {
        require(_dpr <= CEILING, "PTH/dpr-gt-100%");
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

        require(tiersTotalSum <= CEILING, "PTH/tiers-gt-100%");
    }

    /**
     * @notice Push PrizeTierV2 struct onto `prizeTiers` array.
     * @dev Callable only by the owner or manager.
     * @dev `drawId` must be greater than the latest one stored in `history`.
     * @param _prizeTier Next PrizeTierV2 struct
     */
    function _push(PrizeTierV2 memory _prizeTier) internal {
        uint32 _length = uint32(history.length);

        if (_length > 0) {
            uint32 _id = history[_length - 1];
            require(_prizeTier.drawId > _id, "PTH/non-sequential-id");
        }

        _checkDPR(_prizeTier.dpr);
        _checkTiersTotalSum(_prizeTier.tiers);

        history.push(_prizeTier.drawId);
        prizeTiers[_length] = _prizeTier;

        emit PrizeTierPushed(_prizeTier.drawId, _prizeTier);
    }

    /**
     * @notice Replace PrizeTierV2 struct in `prizeTiers` array.
     * @dev Callable only by the owner.
     * @param _prizeTier PrizeTierV2 parameters
     */
    function _replace(PrizeTierV2 calldata _prizeTier) internal {
        uint256 cardinality = history.length;
        require(cardinality > 0, "PTH/no-prize-tiers");

        uint32 oldestDrawId = history[0];
        require(_prizeTier.drawId >= oldestDrawId, "PTH/draw-id-out-of-range");

        uint32 index = history.binarySearch(_prizeTier.drawId);
        require(history[index] == _prizeTier.drawId, "PTH/draw-id-must-match");

        _checkDPR(_prizeTier.dpr);
        _checkTiersTotalSum(_prizeTier.tiers);

        prizeTiers[index] = _prizeTier;

        emit PrizeTierSet(_prizeTier.drawId, _prizeTier);
    }
}
