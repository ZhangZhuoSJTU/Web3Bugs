// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract MockUniswapPair is ERC20 {
    using SafeERC20 for IERC20;

    address public immutable token0;
    address public immutable token1;

    constructor(
        address _token0,
        address _token1
    )
        public
        ERC20("Uniswap Pair", "UNI-V2")
    {
        token0 = _token0;
        token1 = _token1;
    }

    function addLiquidity(
        uint256 _amount0,
        uint256 _amount1,
        uint256 _amountOut
    )
        external
    {
        IERC20(token0).safeTransferFrom(msg.sender, address(this), _amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), _amount1);
        _mint(msg.sender, _amountOut);
    }

    function getReserves()
        external
        view
        returns (uint112, uint112, uint32)
    {
        return (
            uint112(IERC20(token0).balanceOf(address(this))),
            uint112(IERC20(token1).balanceOf(address(this))),
            uint32(block.timestamp)
        );
    }
}
