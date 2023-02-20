// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

interface IMinter {
    function mint(address _to, uint256 _amount) external;

    function hasPermission(address _user) external view returns (bool);

    function isVault(address _vault) external view returns(bool);
}
