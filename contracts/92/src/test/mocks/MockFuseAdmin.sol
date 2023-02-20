// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {FuseAdmin} from "../../interfaces/FuseAdmin.sol";

contract MockFuseAdmin is FuseAdmin {
    mapping(address => bool) public isWhitelisted;

    function _setWhitelistStatuses(address[] calldata users, bool[] calldata enabled) external {
        for (uint256 i = 0; i < users.length; i++) isWhitelisted[users[i]] = enabled[i];
    }

    function _deployMarket(
        address underlying,
        address irm,
        string calldata name,
        string calldata symbol,
        address impl,
        bytes calldata data,
        uint256 reserveFactor,
        uint256 adminFee,
        uint256 collateralFactorMantissa
    ) external {
        
    }
}
