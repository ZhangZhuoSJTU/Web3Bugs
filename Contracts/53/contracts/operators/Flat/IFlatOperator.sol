// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title FlatOperator Operator Interface
interface IFlatOperator {
    /// @notice Execute the flat operator... it does nothing !
    /// @param self The operator address (for delegatecall context resolution).
    /// This parameter is useless for this operator (no storage), but cant be removed.
    /// @param token The token address
    /// @param amount The amount
    /// @return amounts Array of output amounts
    /// @return tokens Array of output tokens
    function commitAndRevert(
        address self,
        address token,
        uint256 amount
    ) external payable returns (uint256[] memory amounts, address[] memory tokens);
}
