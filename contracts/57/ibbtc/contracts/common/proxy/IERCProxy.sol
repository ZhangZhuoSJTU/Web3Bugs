// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IERCProxy {
    function proxyType() external pure returns (uint proxyTypeId);
    function implementation() external view returns (address codeAddr);
}
