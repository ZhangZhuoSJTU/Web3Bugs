// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./IManager.sol";

interface IHarvester {
    function addStrategy(address, address, uint256) external;
    function manager() external view returns (IManager);
    function removeStrategy(address, address, uint256) external;
}

