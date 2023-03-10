// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import "../interfaces/IExperiPie.sol";
import "../interfaces/IRebalanceManagerV3.sol";

contract RebalanceManagerV3 is IRebalanceManagerV3 {
    IExperiPie public immutable basket;
    uint256 public immutable lockTime;
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

    constructor(
        address _basket,
        address _uniswapV2Like,
        uint256 _lockTime
    ) {
        require(_basket != address(0), "INVALID_BASKET");
        require(_uniswapV2Like != address(0), "INVALID_UNISWAP_V2");

        basket = IExperiPie(_basket);
        rebalanceManager = msg.sender;
        exchanges[_uniswapV2Like] = true;
        lockTime = _lockTime;
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
        address exchange,
        uint256 quantity,
        uint256 minReturn,
        address[] calldata path,
        address recipient,
        uint256 deadline
    ) internal {
        if (IERC20(path[0]).allowance(address(basket), exchange) < quantity) {
            basket.singleCall(
                path[0],
                abi.encodeWithSelector(
                    IERC20(path[0]).approve.selector,
                    address(exchange),
                    uint256(-1)
                ),
                0
            );
        }

        // Swap on exchange
        basket.singleCall(
            exchange,
            abi.encodeWithSelector(
                IUniswapV2Router02(exchange).swapExactTokensForTokens.selector,
                quantity,
                minReturn,
                path,
                recipient,
                deadline
            ),
            0
        );

        emit Swaped(
            address(basket),
            path[0],
            path[path.length - 1],
            quantity,
            minReturn
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
        @notice Lock before Rebalance
    */
    function lock() external onlyRebalanceManager {
        lockBasketData(block.number + lockTime);
    }

    /**
        @notice Rebalance underling token
        @param _swapsV2 Swaps to perform
        @param _deadline Unix timestamp after which the transaction will revert.
    */
    function rebalance(UnderlyingTrade[] calldata _swapsV2, uint256 _deadline)
        external
        override
        onlyRebalanceManager
    {
        require(basket.getLock(), "REQUIRE_LOCK");
        lockBasketData(block.number + 30);

        for (uint256 i; i < _swapsV2.length; i++) {
            UnderlyingTrade calldata trade = _swapsV2[i];
            uint256 input = trade.quantity;
            address targetToken = trade.swaps[0].path[0];
            //internal trades
            for (uint256 j; j < trade.swaps.length; j++) {
                UniswapV2SwapStruct calldata swap = trade.swaps[j];
                require(exchanges[swap.exchange], "INVALID_EXCHANGE");
                require(targetToken == swap.path[0], "INVALID_INPUT_TOKEN");
                targetToken = swap.path[swap.path.length - 1];

                uint256 oldBalance = IERC20(targetToken).balanceOf(
                    address(basket)
                );
                //swap token
                _swapUniswapV2(
                    swap.exchange,
                    input,
                    0,
                    swap.path,
                    address(basket),
                    _deadline
                );
                //The output of this trade is the input for the next trade
                input =
                    IERC20(targetToken).balanceOf(address(basket)) -
                    oldBalance;
            }
            require(trade.minimumReturn <= input, "INSUFFICIENT_OUTPUT_AMOUNT");
            //add to token if missing
            UniswapV2SwapStruct calldata toAdd = trade.swaps[
                trade.swaps.length - 1
            ];
            addToken(toAdd.path[toAdd.path.length - 1]);

            //remove from token if resulting quantity is 0
            removeToken(trade.swaps[0].path[0]);
        }

        emit Rebalanced(address(basket));
    }
}
