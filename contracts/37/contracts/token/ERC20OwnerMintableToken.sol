// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// This is a simplified implementation, but compatible with
/// OpenZeppelin's ERC20Mintable and ERC20Burnable extensions.
contract ERC20OwnerMintableToken is ERC20 {
    /// The manager who is allowed to mint and burn.
    address public immutable manager;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        manager = msg.sender;
    }

    /// Creates `amount` new tokens for `to`.
    /// @param account Recipient address to mint tokens to
    /// @param amount Number of tokens to mint
    function mint(address account, uint256 amount) external {
        require(msg.sender == manager, "mint: only manager can mint");
        _mint(account, amount);
    }

    /// Destroys `amount` tokens from the caller.
    /// @param amount Number of tokens to burn.
    function burn(uint256 amount) public {
        require(msg.sender == manager, "burn: only manager can burn");
        _burn(manager, amount);
    }

    /// Destroys `amount` tokens from `account`.
    /// @param account Source address to burn tokens from
    /// @param amount Number of tokens to burn
    function burnFrom(address account, uint256 amount) public {
        require(msg.sender == manager, "burn: only manager can burn");
        _burn(account, amount);
    }
}
