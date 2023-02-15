pragma solidity ^0.6.6;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestUniswapLiquidity is Ownable {
	address router;

	constructor(address _uni_router) public {
		router = _uni_router;
	}

	function redeemLiquidityETH(
		address token,
		uint256 liquidity,
		uint256 amountTokenMin,
		uint256 amountETHMin,
		address to,
		uint256 deadline
	) public onlyOwner {
		address pair =
			UniswapV2Library.pairFor(
				IUniswapV2Router02(router).factory(),
				token,
				IUniswapV2Router02(router).WETH()
			);
		IUniswapV2Pair(pair).approve(router, 2**256 - 1);

		IUniswapV2Router02(router).removeLiquidityETH(
			token,
			liquidity,
			amountTokenMin,
			amountETHMin,
			to,
			deadline
		);
	}

	function redeemLiquidity(
		address tokenA,
		address tokenB,
		uint256 liquidity,
		uint256 amountAMin,
		uint256 amountBMin,
		address to,
		uint256 deadline
	) public onlyOwner {
		IUniswapV2Router02(router).removeLiquidity(
			tokenA,
			tokenB,
			liquidity,
			amountAMin,
			amountBMin,
			to,
			deadline
		);
	}

	function transferTokens(
		address _to,
		uint256 _a,
		uint256 _b,
		address state_tokenContract
	) public onlyOwner {
		IERC20(state_tokenContract).transfer(_to, _a + _b);
	}
}
