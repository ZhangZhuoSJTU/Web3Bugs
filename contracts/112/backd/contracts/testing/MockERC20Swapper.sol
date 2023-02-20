// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../libraries/ScaledMath.sol";
import "../../interfaces/ISwapper.sol";

contract MockERC20Swapper is ISwapper {
    using ScaledMath for uint256;
    uint256 public constant RATE = 1.1 * 1e18;

    function swap(
        address,
        address toToken,
        uint256 swapAmount,
        uint256
    ) external override returns (uint256) {
        // Assumes a suffient amount of toTokens was minted to the contract
        uint256 amount = swapAmount.scaledMul(RATE);
        ERC20(toToken).transfer(msg.sender, amount);
        return amount;
    }

    function getRate(address, address) external pure override returns (uint256) {
        return RATE;
    }
}
