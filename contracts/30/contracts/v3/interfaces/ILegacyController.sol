// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface ILegacyController {
    function legacyDeposit(address _token, uint256 _expected) external;
}
