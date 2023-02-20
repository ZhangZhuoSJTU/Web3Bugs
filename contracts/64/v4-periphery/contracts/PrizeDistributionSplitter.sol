// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@pooltogether/v4-core/contracts/interfaces/IPrizeDistributionSource.sol";

/**
 * @title  PoolTogether V4 PrizeDistributionSplitter
 * @author PoolTogether Inc Team
 * @notice The PrizeDistributionSplitter contract allows us to deploy
            a second PrizeDistributionBuffer contract and point contracts that will call this one,
            to the correct PrizeDistributionBuffer contract.
            To do so, we set a `drawId` at which the second PrizeDistributionBuffer contract was deployed,
            when calling the `getPrizeDistributions` function with a `drawId` greater than or equal to the one set,
            we query the second PrizeDistributionBuffer contract, otherwise we query the first.
 */
contract PrizeDistributionSplitter is IPrizeDistributionSource {
    /// @notice DrawId at which the split occured
    uint32 public immutable drawId;

    /// @notice First PrizeDistributionBuffer source address
    IPrizeDistributionSource public immutable prizeDistributionSourceBefore;

    /// @notice Second PrizeDistributionBuffer source address
    IPrizeDistributionSource public immutable prizeDistributionSourceAtOrAfter;

    /* ============ Events ============ */

    /**
     * @notice Emitted when the drawId is set
     * @param drawId The drawId that was set
     */
    event DrawIdSet(uint32 drawId);

    /**
     * @notice Emitted when prize distribution sources are set
     * @param prizeDistributionSourceBefore First PrizeDistributionBuffer contract address
     * @param prizeDistributionSourceAtOrAfter Second PrizeDistributionBuffer contract address
     */
    event PrizeDistributionSourcesSet(
        IPrizeDistributionSource prizeDistributionSourceBefore,
        IPrizeDistributionSource prizeDistributionSourceAtOrAfter
    );

    /* ============ Constructor ============ */

    /**
     * @notice Constructor for PrizeDistributionSource
     * @param _drawId DrawId at which the split occured
     * @param _prizeDistributionSourceBefore First PrizeDistributionBuffer contract address
     * @param _prizeDistributionSourceAtOrAfter Second PrizeDistributionBuffer contract address
     */
    constructor(
        uint32 _drawId,
        IPrizeDistributionSource _prizeDistributionSourceBefore,
        IPrizeDistributionSource _prizeDistributionSourceAtOrAfter
    ) {
        require(_drawId > 0, "PrizeDistSplitter/drawId-gt-zero");
        _requirePrizeDistNotZeroAddress(address(_prizeDistributionSourceBefore));
        _requirePrizeDistNotZeroAddress(address(_prizeDistributionSourceAtOrAfter));

        drawId = _drawId;
        prizeDistributionSourceBefore = _prizeDistributionSourceBefore;
        prizeDistributionSourceAtOrAfter = _prizeDistributionSourceAtOrAfter;

        emit DrawIdSet(_drawId);
        emit PrizeDistributionSourcesSet(
            _prizeDistributionSourceBefore,
            _prizeDistributionSourceAtOrAfter
        );
    }

    /* ============ External Functions ============ */

    /// @inheritdoc IPrizeDistributionSource
    function getPrizeDistributions(uint32[] calldata _drawIds)
        external
        view
        override
        returns (IPrizeDistributionSource.PrizeDistribution[] memory)
    {
        uint256 _drawIdsLength = _drawIds.length;
        uint32 _drawIdSplit = drawId;
        uint256 _atOrAfterIndex;

        for (_atOrAfterIndex; _atOrAfterIndex < _drawIdsLength; _atOrAfterIndex++) {
            if (_drawIds[_atOrAfterIndex] >= _drawIdSplit) {
                break;
            }
        }

        uint32[] memory _drawIdsBefore;
        uint32[] memory _drawIdsAtOrAfter;

        uint256 _drawIdsAtOrAfterLength = _drawIdsLength - _atOrAfterIndex;

        if (_atOrAfterIndex > 0) {
            _drawIdsBefore = new uint32[](_atOrAfterIndex);
        }

        if (_drawIdsAtOrAfterLength > 0) {
            _drawIdsAtOrAfter = new uint32[](_drawIdsAtOrAfterLength);
        }

        uint32 _previousDrawId;

        for (uint256 i; i < _drawIdsLength; i++) {
            uint32 _currentDrawId = _drawIds[i];
            require(_currentDrawId > _previousDrawId, "PrizeDistSplitter/drawId-asc");

            if (i < _atOrAfterIndex) {
                _drawIdsBefore[i] = _currentDrawId;
            } else {
                _drawIdsAtOrAfter[i - _atOrAfterIndex] = _currentDrawId;
            }

            _previousDrawId = _currentDrawId;
        }

        if (_drawIdsBefore.length == 0) {
            return prizeDistributionSourceAtOrAfter.getPrizeDistributions(_drawIdsAtOrAfter);
        } else if (_drawIdsAtOrAfter.length == 0) {
            return prizeDistributionSourceBefore.getPrizeDistributions(_drawIdsBefore);
        }

        IPrizeDistributionSource.PrizeDistribution[]
            memory _prizeDistributionsBefore = prizeDistributionSourceBefore.getPrizeDistributions(
                _drawIdsBefore
            );

        IPrizeDistributionSource.PrizeDistribution[]
            memory _prizeDistributionsAtOrAfter = prizeDistributionSourceAtOrAfter
                .getPrizeDistributions(_drawIdsAtOrAfter);

        IPrizeDistributionSource.PrizeDistribution[]
            memory _prizeDistributions = new IPrizeDistributionSource.PrizeDistribution[](
                _drawIdsLength
            );

        for (uint256 i = 0; i < _drawIdsLength; i++) {
            if (i < _atOrAfterIndex) {
                _prizeDistributions[i] = _prizeDistributionsBefore[i];
            } else {
                _prizeDistributions[i] = _prizeDistributionsAtOrAfter[i - _atOrAfterIndex];
            }
        }

        return _prizeDistributions;
    }

    /* ============ Require Functions ============ */

    /**
     * @notice Require that the given `_prizeDistributionSource` address is not the zero address
     * @param _prizeDistributionSource Address to check
     */
    function _requirePrizeDistNotZeroAddress(address _prizeDistributionSource) internal pure {
        require(_prizeDistributionSource != address(0), "PrizeDistSplitter/not-zero-addr");
    }
}
