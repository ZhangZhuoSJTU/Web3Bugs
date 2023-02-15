// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface ProxyUpgrade {
    function upgradeTo(address newImplementation) external;
}
