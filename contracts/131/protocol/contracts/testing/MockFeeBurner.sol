// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../interfaces/IController.sol";
import "../../interfaces/IAddressProvider.sol";
import "../../interfaces/pool/ILiquidityPool.sol";
import "../testing/MockErc20.sol";

contract MockFeeBurner {
    using SafeERC20 for IERC20;

    address public controller;
    IAddressProvider public addressProvider;

    constructor(address _controller) {
        controller = _controller;
        addressProvider = IController(_controller).addressProvider();
    }

    // Transfers all pool underlying from sender and "swaps" these for target LP token
    function burnToTarget(address[] memory tokens, address targetLpToken)
        external
        payable
        returns (uint256)
    {
        for (uint256 i; i < tokens.length; i++) {
            address underlying = tokens[i];
            if (underlying != address(0)) {
                uint256 balance = IERC20(underlying).balanceOf(msg.sender);
                IERC20(underlying).safeTransferFrom(msg.sender, address(this), balance);
            }
        }

        // By default returns 1e18 of targetLpToken
        MockErc20(targetLpToken).mint_for_testing(msg.sender, 1e18);
    }
}
