// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.10;

import "../utils/types/Fixed18.sol";

interface IOracle {
    event Version(uint256 version, uint256 timestamp, Fixed18 price);

    function sync() external;
    function priceAtVersion(uint256 version) external view returns (Fixed18);
    function timestampAtVersion(uint256 version) external view returns (uint256);
    function currentVersion() external view returns (uint256);
}
