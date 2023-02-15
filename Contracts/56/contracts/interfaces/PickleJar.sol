// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

interface PickleJar {
    function balanceOf(address account) external view returns (uint);
    function balance() external view returns (uint);
    function available() external view returns (uint);
    function depositAll() external;
    function deposit(uint _amount) external;
    function withdrawAll() external;
    function withdraw(uint _shares) external;
    function getRatio() external view returns (uint);
}
