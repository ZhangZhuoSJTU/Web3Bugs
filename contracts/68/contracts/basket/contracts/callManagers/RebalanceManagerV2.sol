// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import "../interfaces/IExperiPie.sol";
import "../interfaces/IRebalanceManagerV2.sol";

contract RebalanceManagerV2 is IRebalanceManagerV2 {
    IExperiPie public immutable basket;

    mapping(address => bool) public exchanges;

    address public rebalanceManager;

    event Rebalanced(address indexed basket);
    event Swaped(
        address indexed basket,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 quantity,
        uint256 returnedQuantity
    );
    event RebalanceManagerSet(address indexed rebalanceManager);

    constructor(address _basket, address _uniswapV2Like) {
        require(_basket != address(0), "INVALID_BASKET");
        require(_uniswapV2Like != address(0), "INVALID_UNISWAP_V2");

        basket = IExperiPie(_basket);
        rebalanceManager = msg.sender;
        exchanges[_uniswapV2Like] = true;
    }

    modifier onlyRebalanceManager() {
        require(msg.sender == rebalanceManager, "NOT_REBALANCE_MANAGER");
        _;
    }

    function setRebalanceManager(address _rebalanceManager)
        external
        onlyRebalanceManager
    {
        rebalanceManager = _rebalanceManager;
        emit RebalanceManagerSet(_rebalanceManager);
    }

    function setExchange(address _exchange, bool _activated)
        external
        onlyRebalanceManager
    {
        exchanges[_exchange] = _activated;
    }

    function _swapUniswapV2(
        UniswapV2SwapStruct calldata swap,
        address recipient,
        uint256 deadline
    ) internal {
        if (
            IERC20(swap.path[0]).allowance(address(basket), swap.exchange) <
            swap.quantity
        ) {
            basket.singleCall(
                swap.path[0],
                abi.encodeWithSelector(
                    IERC20(swap.path[0]).approve.selector,
                    address(swap.exchange),
                    uint256(-1)
                ),
                0
            );
        }
        // Swap on exchange
        // exchange.swapExactTokensForTokens(amount, minReturnAmount, path, recipient, deadline);
        basket.singleCall(
            swap.exchange,
            abi.encodeWithSelector(
                IUniswapV2Router02(swap.exchange)
                    .swapExactTokensForTokens
                    .selector,
                swap.quantity,
                swap.minReturn,
                swap.path,
                recipient,
                deadline
            ),
            0
        );

        emit Swaped(
            address(basket),
            swap.path[0],
            swap.path[swap.path.length - 1],
            swap.quantity,
            swap.minReturn
        );
    }

    function removeToken(address _token) internal {
        uint256 balance = basket.balance(_token);
        bool inPool = basket.getTokenInPool(_token);
        //if there is a token balance of the token is not in the pool, skip
        if (balance != 0 || !inPool) {
            return;
        }

        // remove token
        basket.singleCall(
            address(basket),
            abi.encodeWithSelector(basket.removeToken.selector, _token),
            0
        );
    }

    function addToken(address _token) internal {
        uint256 balance = basket.balance(_token);
        bool inPool = basket.getTokenInPool(_token);
        // If token has no balance or is already in the pool, skip
        if (balance == 0 || inPool) {
            return;
        }

        // add token
        basket.singleCall(
            address(basket),
            abi.encodeWithSelector(basket.addToken.selector, _token),
            0
        );
    }

    function lockBasketData(uint256 _block) internal {
        basket.singleCall(
            address(basket),
            abi.encodeWithSelector(basket.setLock.selector, _block),
            0
        );
    }

    /**
        @notice Rebalance underling token
        @param _swapsV2 Swaps to perform
        @param _deadline Unix timestamp after which the transaction will revert.
    */
    function rebalance(
        UniswapV2SwapStruct[] calldata _swapsV2,
        uint256 _deadline
    ) external override onlyRebalanceManager {
        lockBasketData(block.number + 30);

        // remove token from array
        for (uint256 i; i < _swapsV2.length; i++) {
            require(exchanges[_swapsV2[i].exchange], "NOT_UNISWAP_V2");

            //swap token
            _swapUniswapV2(_swapsV2[i], address(basket), _deadline);

            //add to token if missing
            addToken(_swapsV2[i].path[_swapsV2[i].path.length - 1]);

            //remove from token if resulting quantity is 0
            removeToken(_swapsV2[i].path[0]);
        }

        emit Rebalanced(address(basket));
    }
}
