// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/IYetiRouter.sol";
import "../Interfaces/IERC20.sol";
import "../Dependencies/SafeMath.sol";
import "../YUSDToken.sol";

// ERC20 router contract to be used for routing YUSD -> ERC20 and then wrapping.
// simple router using TJ router. 
contract ERC20Router is IYetiRouter {
    using SafeMath for uint256;

    address internal activePoolAddress;
    address internal traderJoeRouter;
    address internal yusdTokenAddress;
    string public name;

    constructor(
        string memory _name,
        address _activePoolAddress,
        address _traderJoeRouter, 
        address _yusdTokenAddress
    ) public {
        name = _name;
        activePoolAddress = _activePoolAddress;
        traderJoeRouter = _traderJoeRouter;
        yusdTokenAddress = _yusdTokenAddress;
    }

    // Takes the address of the token in, and gives a certain amount of token out.
    // Auto transfers to active pool.
    function route(
        address _fromUser,
        address _startingTokenAddress,
        address _endingTokenAddress,
        uint256 _amount,
        uint256 _minSwapAmount
    ) public override returns (uint256) {
        require(
            _startingTokenAddress == yusdTokenAddress,
            "Cannot route from a token other than YUSD"
        );
        address[] memory path = new address[](2);
        path[0] = yusdTokenAddress;
        path[1] = _endingTokenAddress;
        IERC20(yusdTokenAddress).transferFrom(_fromUser, address(this), _amount);
        IERC20(yusdTokenAddress).approve(traderJoeRouter, _amount);
        uint256[] memory amounts = IRouter(traderJoeRouter).swapExactTokensForTokens(
            _amount,
            1,
            path,
            activePoolAddress,
            block.timestamp
        );
        require(
            amounts[1] >= _minSwapAmount,
            "Did not receive enough tokens to account for slippage"
        );

        return amounts[1];
    }

    function unRoute(
        address _fromUser,
        address _startingTokenAddress,
        address _endingTokenAddress,
        uint256 _amount,
        uint256 _minSwapAmount
    ) external override returns (uint256) {
        require(
            _endingTokenAddress == yusdTokenAddress,
            "Cannot unroute from a token other than YUSD"
        );
        address[] memory path = new address[](2);
        path[0] = _startingTokenAddress;
        path[1] = yusdTokenAddress;
        IERC20(_startingTokenAddress).transferFrom(_fromUser, address(this), _amount);
        IERC20(_startingTokenAddress).approve(traderJoeRouter, _amount);
        uint256[] memory amounts = IRouter(traderJoeRouter).swapExactTokensForTokens(
            _amount,
            1,
            path,
            _fromUser,
            block.timestamp
        );
        require(
            amounts[1] >= _minSwapAmount,
            "Did not receive enough tokens to account for slippage"
        );

        return amounts[1];

    }
}

// Router for Uniswap V2, performs YUSD -> YETI swaps
interface IRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
