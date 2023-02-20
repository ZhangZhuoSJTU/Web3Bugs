// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./PoolShare.sol";

/// @dev Token representing the principal shares of a pool.
contract PrincipalShare is PoolShare {
    constructor(
        ITempusPool _pool,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) PoolShare(ShareKind.Principal, _pool, name, symbol, decimals) {}

    // solhint-disable-previous-line no-empty-blocks

    function getPricePerFullShare() external override returns (uint256) {
        return pool.pricePerPrincipalShare();
    }

    function getPricePerFullShareStored() external view override returns (uint256) {
        return pool.pricePerPrincipalShareStored();
    }
}
