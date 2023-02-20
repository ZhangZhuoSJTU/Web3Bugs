// SPDX-License-Identifier: MIT

pragma solidity =0.8.10;

import { IXDEFIDistribution } from "./interfaces/IXDEFIDistribution.sol";
import { IXDEFIDistributionHelper } from "./interfaces/IXDEFIDistributionHelper.sol";

/// @dev Stateless helper contract for external clients to reduce web3 calls to gather XDEFIDistribution information related to individual accounts.
contract XDEFIDistributionHelper is IXDEFIDistributionHelper {

    function getAllTokensForAccount(address xdefiDistribution_, address account_) public view returns (uint256[] memory tokenIds_) {
        uint256 count = IXDEFIDistribution(xdefiDistribution_).balanceOf(account_);
        tokenIds_ = new uint256[](count);

        for (uint256 i; i < count; ++i) {
            tokenIds_[i] = IXDEFIDistribution(xdefiDistribution_).tokenOfOwnerByIndex(account_, i);
        }
    }

    function getAllLockedPositionsForAccount(address xdefiDistribution_, address account_) public view returns (uint256[] memory tokenIds_, IXDEFIDistribution.Position[] memory positions_, uint256[] memory withdrawables_) {
        uint256[] memory tokenIds = getAllTokensForAccount(xdefiDistribution_, account_);

        uint256 allTokenCount = tokenIds.length;

        IXDEFIDistribution.Position[] memory positions = new IXDEFIDistribution.Position[](allTokenCount);

        uint256 validPositionCount;

        for (uint256 i; i < allTokenCount; ++i) {
            (uint96 units, uint88 depositedXDEFI, uint32 expiry, uint32 created, uint8 bonusMultiplier, int256 pointsCorrection) = IXDEFIDistribution(xdefiDistribution_).positionOf(tokenIds[i]);

            if (expiry == uint32(0)) continue;

            tokenIds[validPositionCount] = tokenIds[i];
            positions[validPositionCount++] = IXDEFIDistribution.Position(units, depositedXDEFI, expiry, created, bonusMultiplier, pointsCorrection);
        }

        tokenIds_ = new uint256[](validPositionCount);
        positions_ = new IXDEFIDistribution.Position[](validPositionCount);
        withdrawables_ = new uint256[](validPositionCount);

        for (uint256 i; i < validPositionCount; ++i) {
            positions_[i] = positions[i];
            withdrawables_[i] = IXDEFIDistribution(xdefiDistribution_).withdrawableOf(tokenIds_[i] = tokenIds[i]);
        }
    }

}
