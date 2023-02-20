// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IAdmin {
    event NewAdminAdded(address newAdmin);
    event AdminRenounced(address oldAdmin);

    function admins() external view returns (address[] memory);

    function addAdmin(address newAdmin) external returns (bool);

    function renounceAdmin() external returns (bool);

    function isAdmin(address account) external view returns (bool);
}
