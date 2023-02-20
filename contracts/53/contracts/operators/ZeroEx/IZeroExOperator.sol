// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ZeroEx Operator Interface
interface IZeroExOperator {
    /// @notice Execute a swap via 0x
    /// @param self The operator address (for delegatecall context resolution)
    /// @param sellToken The token sold
    /// @param buyToken The token bought
    /// @param swapSelector The selector of the ZeroEx function
    /// @param swapCallData 0x calldata from the API
    /// @return amounts Array of output amounts
    /// @return tokens Array of output tokens
    function commitAndRevert(
        address self,
        IERC20 sellToken,
        IERC20 buyToken,
        bytes4 swapSelector,
        bytes calldata swapCallData
    ) external payable returns (uint256[] memory amounts, address[] memory tokens);
}
