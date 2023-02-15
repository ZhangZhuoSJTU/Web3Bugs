// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "./IOracleProvider.sol";

interface IChainlinkOracleProvider is IOracleProvider {
    function setFeed(address asset, address feed) external;

    function setStalePriceDelay(uint256 stalePriceDelay_) external;
}
