// SPDX-License-Identifier: MIT
pragma solidity ^0.6.11;

interface ISettAccessControlDefended {
    function approveContractAccess(address account) external;

    function revokeContractAccess(address account) external;
}
