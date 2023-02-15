// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../../math/WMul.sol";
import "../../../math/WDiv.sol";
import "./UniswapV3FactoryMock.sol";
import "./UniswapV3PoolMock.sol";

/// @title Uniswap V3 Oracle Library Mock
/// @notice Just for testing purposes
library UniswapV3OracleLibraryMock {

    using WMul for uint256;
    using WDiv for uint256;

    /// @notice Always provides the double of the base amount as the price of the base token expressed in the quote token
    function consult(
        address factory,
        address baseToken,
        address quoteToken,
        uint24 fee,
        uint256 baseAmount,
        uint32 /* secondsAgo */
    ) internal view returns (uint256 quoteAmount) {
        UniswapV3PoolMock pool = UniswapV3PoolMock(UniswapV3FactoryMock(factory).getPool(baseToken, quoteToken, fee));
        if (baseToken == pool.token0()) {
            return baseAmount.wmul(pool.price());
        }
        return baseAmount.wdiv(pool.price());
    }
}