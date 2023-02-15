// SPDX-License-Identifier: MIT

pragma solidity =0.8.10;

import { IXDEFIDistribution } from "./IXDEFIDistribution.sol";

interface IXDEFIDistributionHelper {

    function getAllTokensForAccount(address xdefiDistribution_, address account_) external view returns (uint256[] memory tokenIds_);

    function getAllLockedPositionsForAccount(address xdefiDistribution_, address account_) external view returns (uint256[] memory tokenIds_, IXDEFIDistribution.Position[] memory positions_, uint256[] memory withdrawables_);

}
