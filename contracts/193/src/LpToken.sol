// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "solmate/auth/Owned.sol";
import "solmate/tokens/ERC20.sol";

/// @title LP token
/// @author out.eth (@outdoteth)
/// @notice LP token which is minted and burned by the Pair contract to represent liquidity in the pool.
contract LpToken is Owned, ERC20 {
    constructor(string memory pairSymbol)
        Owned(msg.sender)
        ERC20(string.concat(pairSymbol, " LP token"), string.concat("LP-", pairSymbol), 18)
    {}

    /// @notice Mints new LP tokens to the given address.
    /// @param to The address to mint to.
    /// @param amount The amount to mint.
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /// @notice Burns LP tokens from the given address.
    /// @param from The address to burn from.
    /// @param amount The amount to burn.
    function burn(address from, uint256 amount) public onlyOwner {
        _burn(from, amount);
    }
}
