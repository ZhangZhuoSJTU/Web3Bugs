// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

interface IVault {
    function token() external view returns (address);
    function priceE18() external view returns (uint);
    function deposit(uint) external;
    function withdraw(uint) external;
    function depositAll() external;
    function withdrawAll() external;
}
