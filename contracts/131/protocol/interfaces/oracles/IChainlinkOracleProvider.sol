// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./IOracleProvider.sol";

interface IChainlinkOracleProvider is IOracleProvider {
    function setStalePriceDelay(uint256 stalePriceDelay_) external;
}
