// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../vault/EthVault.sol";
import "../vault/Erc20Vault.sol";

abstract contract MockVaultMethods is Vault {
    function setStrategy(address _strategy) external onlyGovernance returns (bool) {
        if (address(getStrategy()) == _strategy) return false;

        _setConfig(_STRATEGY_KEY, _strategy);
        return true;
    }

    function setTargetAllocation(uint256 allocation) external onlyGovernance returns (uint256) {
        _setConfig(_TARGET_ALLOCATION_KEY, allocation);
        return allocation;
    }

    function setBound(uint256 newBound) external onlyGovernance returns (uint256) {
        _setConfig(_BOUND_KEY, newBound);
        return newBound;
    }

    function depositToReserve(address coin, uint256 amount) external {
        IERC20(coin).approve(address(reserve), amount);
        reserve.deposit(coin, amount);
    }

    function withdrawFromReserve(address coin, uint256 amount) external {
        reserve.withdraw(coin, amount);
    }
}

contract MockErc20Vault is Erc20Vault, MockVaultMethods {
    constructor(IController controller) Erc20Vault(controller) {}
}

contract MockEthVault is EthVault, MockVaultMethods {
    constructor(IController controller) EthVault(controller) {}
}
