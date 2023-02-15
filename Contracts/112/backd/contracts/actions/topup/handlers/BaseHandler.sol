// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "../../../../interfaces/actions/topup/ITopUpHandler.sol";

abstract contract BaseHandler is ITopUpHandler {
    /// @dev Handlers will be called through delegatecall from the topup action
    /// so we add a gap to ensure that the children contracts do not
    /// overwrite the topup action storage
    uint256[100] private __gap;
}
