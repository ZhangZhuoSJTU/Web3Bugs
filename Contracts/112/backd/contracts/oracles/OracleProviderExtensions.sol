// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "../../libraries/ScaledMath.sol";
import "../../interfaces/oracles/IOracleProvider.sol";

library OracleProviderExtensions {
    using ScaledMath for uint256;

    function getRelativePrice(
        IOracleProvider priceOracle,
        address fromToken,
        address toToken
    ) internal view returns (uint256) {
        return priceOracle.getPriceUSD(fromToken).scaledDiv(priceOracle.getPriceUSD(toToken));
    }
}
