// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IAdminUpgradeabilityProxy {
    // Read functions.
    function admin() external view returns (address);
    function implementation() external view returns (address);

    // Write functions.
    function changeAdmin(address newAdmin) external;
    function upgradeTo(address newImplementation) external;
}
