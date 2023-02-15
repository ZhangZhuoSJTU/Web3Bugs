// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../../deps/@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract MockToken is ERC20Upgradeable {
    function initialize(address[] memory holders, uint256[] memory balances)
        public
        initializer
    {
        __ERC20_init("Mock", "Mock");
        require(
            holders.length == balances.length,
            "Constructor array size mismatch"
        );
        for (uint256 i = 0; i < holders.length; i++) {
            _mint(holders[i], balances[i]);
        }
    }

    /// @dev Open minting capabilities
    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    /// @dev Open burning capabilities, from any account
    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }
}
