// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.7;

import "../interfaces/IERC20.sol";
import "../interfaces/IUniV3SwapRouter.sol";
import "../libs/SafeERC20.sol";

interface IAaveLendingPool {
  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  ) external;
  function withdraw(
    address asset,
    uint256 amount,
    address to
  ) external returns (uint256);
}

// Full interface here: https://github.com/Uniswap/uniswap-v2-periphery/blob/master/contracts/interfaces/IUniswapV2Router01.sol
interface IUniswapSimple {
        function WETH() external pure returns (address);
        function swapTokensForExactTokens(
                uint amountOut,
                uint amountInMax,
                address[] calldata path,
                address to,
                uint deadline
        ) external returns (uint[] memory amounts);
	function swapExactTokensForTokens(
		uint amountIn,
		uint amountOutMin,
		address[] calldata path,
		address to,
		uint deadline
	) external returns (uint[] memory amounts);
}


interface IyVaultV2 {
    //function token() external view returns (address);
    //function deposit() external returns (uint);
    //function deposit(uint) external returns (uint);
    function deposit(uint, address) external returns (uint);
}

// Decisions: will start with aave over compound (easier API - has `onBehalfOf`, referrals), compound can be added later if needed
// uni v3 needs to be supported since it's proving that it's efficient and the router is different
contract WalletZapper {
	struct Trade {
		IUniswapSimple router;
		uint amountIn;
		uint amountOutMin;
		address[] path;
		bool wrap;
	}
	struct DiversificationTrade {
		address tokenOut;
		uint24 fee;
		uint allocPts;
		uint amountOutMin;
		bool wrap;
	}

	address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

	address public admin;
	mapping (address => bool) public allowedSpenders;
	IAaveLendingPool public lendingPool;
	uint16 aaveRefCode;
	constructor(IAaveLendingPool _lendingPool, uint16 _aaveRefCode, address[] memory spenders) {
		admin = msg.sender;
		lendingPool = _lendingPool;
		aaveRefCode = _aaveRefCode;
		allowedSpenders[address(_lendingPool)] = true;
		// This needs to include all of the routers, and all of the Yearn vaults
		for (uint i=0; i!=spenders.length; i++) {
			allowedSpenders[spenders[i]] = true;
		}
	}

	function approveMaxMany(address spender, address[] calldata tokens) external {
		require(msg.sender == admin, "NOT_ADMIN");
		require(allowedSpenders[spender], "NOT_ALLOWED");
		for (uint i=0; i!=tokens.length; i++) {
			SafeERC20.approve(tokens[i], spender, type(uint256).max);
		}
	}

	function approve(address token, address spender, uint amount) external {
		require(msg.sender == admin, "NOT_ADMIN");
		require(allowedSpenders[spender], "NOT_ALLOWED");
		SafeERC20.approve(token, spender, amount);
	}

	// Uniswap V2
	// We're choosing not to implement a special function for performing a single trade since it's not that much of a gas saving compared to this
	// We're also choosing not to implement a method like diversifyV3 which first trades the input asset to WETH and then WETH to whatever,
	//  because we expect diversifyV3 to be enough
	// We can very easily deploy a new Zapper and upgrade to it since it's just a UI change
	function exchangeV2(address[] calldata assetsToUnwrap, Trade[] memory trades) external {
		for (uint i=0; i!=assetsToUnwrap.length; i++) {
			lendingPool.withdraw(assetsToUnwrap[i], type(uint256).max, address(this));
		}
		address to = msg.sender;
		uint deadline = block.timestamp;
		uint len = trades.length;
		for (uint i=0; i!=len; i++) {
			Trade memory trade = trades[i];
			if (!trade.wrap) {
				trade.router.swapExactTokensForTokens(trade.amountIn, trade.amountOutMin, trade.path, to, deadline);
			} else {
				uint[] memory amounts = trade.router.swapExactTokensForTokens(trade.amountIn, trade.amountOutMin, trade.path, address(this), deadline);
				uint lastIdx = trade.path.length - 1;
				lendingPool.deposit(trade.path[lastIdx], amounts[lastIdx], to, aaveRefCode);
			}
		}
		// @TODO are there ways to ensure there are no leftover funds?

	}

	// go in/out of lending assets
	function wrapLending(address[] calldata assetsToWrap) external {
		for (uint i=0; i!=assetsToWrap.length; i++) {
			lendingPool.deposit(assetsToWrap[i], IERC20(assetsToWrap[i]).balanceOf(address(this)), msg.sender, aaveRefCode);
		}
	}
	function unwrapLending(address[] calldata assetsToUnwrap) external {
		for (uint i=0; i!=assetsToUnwrap.length; i++) {
			lendingPool.withdraw(assetsToUnwrap[i], type(uint256).max, msg.sender);
		}
	}

	// wrap WETH
	function wrapETH() payable external {
		// TODO: it may be slightly cheaper to call deposit() directly
		payable(WETH).transfer(msg.value);
	}

	// Uniswap V3
	function tradeV3(ISwapRouter uniV3Router, ISwapRouter.ExactInputParams calldata params) external returns (uint) {
		return uniV3Router.exactInput(params);
	}
	
	function tradeV3Single(ISwapRouter uniV3Router, ISwapRouter.ExactInputSingleParams calldata params, bool wrapOutputToLending) external returns (uint) {
		ISwapRouter.ExactInputSingleParams memory tradeParams = params;
		address recipient = params.recipient;
		if(wrapOutputToLending) {
			tradeParams.recipient = address(this);
		}

		uint amountOut = uniV3Router.exactInputSingle(tradeParams);
		if(wrapOutputToLending) {
			lendingPool.deposit(params.tokenOut, amountOut, recipient, aaveRefCode);
		}
		return amountOut;
	}

	// @TODO: unwrap input from aToken?
	function diversifyV3(ISwapRouter uniV3Router, address inputAsset, uint24 inputFee, uint inputMinOut, DiversificationTrade[] memory trades) external {
		uint inputAmount;
		if (inputAsset != address(0)) {
			inputAmount = uniV3Router.exactInputSingle(
			    ISwapRouter.ExactInputSingleParams (
				inputAsset,
				WETH,
				inputFee,
				address(this),
				block.timestamp,
				IERC20(inputAsset).balanceOf(address(this)),
				inputMinOut,
				0
			    )
			);
		} else {
			inputAmount = IERC20(WETH).balanceOf(address(this));
		}

		uint totalAllocPts;
		uint len = trades.length;
		for (uint i=0; i!=len; i++) {
			DiversificationTrade memory trade = trades[i];
			totalAllocPts += trade.allocPts;
			if (!trade.wrap) {
				uniV3Router.exactInputSingle(
				    ISwapRouter.ExactInputSingleParams (
					WETH,
					trade.tokenOut,
					trade.fee,
					msg.sender,
					block.timestamp,
					inputAmount * trade.allocPts / 1000,
					trade.amountOutMin,
					0
				    )
				);
			} else {
				uint amountToDeposit = uniV3Router.exactInputSingle(
				    ISwapRouter.ExactInputSingleParams (
					WETH,
					trade.tokenOut,
					trade.fee,
					address(this),
					block.timestamp,
					inputAmount * trade.allocPts / 1000,
					trade.amountOutMin,
					0
				    )
				);
				lendingPool.deposit(trade.tokenOut, amountToDeposit, msg.sender, aaveRefCode);
			}
		}

		IERC20 wrappedETH = IERC20(WETH);
		uint wrappedETHAmount = wrappedETH.balanceOf(address(this));
		if (wrappedETHAmount > 0) require(wrappedETH.transfer(msg.sender, wrappedETHAmount));
		// require(totalAllocPts == 1000, "ALLOC_PTS");
	}

	function depositYearn(IyVaultV2 vault, uint amount) external returns (uint) {
		return vault.deposit(amount, msg.sender);
	}

	function recoverFunds(IERC20 token, uint amount) external {
		require(msg.sender == admin, "NOT_ADMIN");
		token.transfer(admin, amount);
	}
}
