// SPDX-License-Identifier: MIT

pragma solidity >= 0.5.0 <= 0.9.0;

interface ISupplySchedule {
    function getMintable(uint lastMintTimestamp) external view returns (uint256);
    function getMintableDebug() external;
    function globalStartTimestamp() external view returns (uint256);
}
