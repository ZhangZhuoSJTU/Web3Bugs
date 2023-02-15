// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

// Generic address whitelist.
interface IAddressWhitelist {
    // Checks if address exists in whitelist.
    function exists(address addr) external returns (bool);
}
