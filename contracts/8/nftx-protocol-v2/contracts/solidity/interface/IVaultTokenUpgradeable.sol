// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../token/IERC20Upgradeable.sol";

interface IVaultTokenUpgradeable is IERC20Upgradeable {
    function mint(address to, uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;
}
