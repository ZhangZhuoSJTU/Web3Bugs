// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";

interface IBalancerPool {
    function getPoolId() external view returns (bytes32);

    function getNormalizedWeights() external view returns (uint256[] memory);

    function getSwapEnabled() external view returns (bool);
}
