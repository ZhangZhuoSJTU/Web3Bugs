// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

interface IGenericVault {
    function token() external view returns (address);
    function getPricePerFullShare() external view returns (uint256);
    function deposit(uint256) external;
    function withdraw(uint256) external;
    function depositAll() external;
    function withdrawAll() external;
}
