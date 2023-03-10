// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoterV2.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import "../interfaces/IExperiPie.sol";
import "../interfaces/IRebalanceManager.sol";

contract RebalanceManager is IRebalanceManager {
    IExperiPie public immutable basket;

    enum ExchangeType {
        NoExchange,
        UniswapV2,
        UniswapV3
    }
    mapping(address => ExchangeType) public exchanges;

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
        address _uniswapV3
    ) {
        require(_basket != address(0), "INVALID_BASKET");
        require(_uniswapV2Like != address(0), "INVALID_UNISWAP_V2");
        require(_uniswapV3 != address(0), "INVALID_UNISWAP_V3");

        basket = IExperiPie(_basket);
        rebalanceManager = msg.sender;
        exchanges[_uniswapV2Like] = ExchangeType.UniswapV2;
        exchanges[_uniswapV3] = ExchangeType.UniswapV3;
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

    function setExchange(address _exchange, ExchangeType exchangeType)
        external
        onlyRebalanceManager
    {
        exchanges[_exchange] = exchangeType;
    }

    function _swapUniswapV3(
        UniswapV3SwapStruct calldata swap,
        address recipient,
        uint256 deadline
    ) internal {
        if (
            IERC20(swap.tokenIn).allowance(address(basket), swap.exchange) <
            swap.quantity
        ) {
            basket.singleCall(
                swap.tokenIn,
                abi.encodeWithSelector(
                    IERC20(swap.tokenIn).approve.selector,
                    address(swap.exchange),
                    uint256(-1)
                ),
                0
            );
        }
        ISwapRouter.ExactInputParams memory params = ISwapRouter
            .ExactInputParams(
                swap.path,
                recipient,
                deadline,
                swap.quantity,
                swap.minReturn
            );

        // Swap on uniswapV3
        // uniswapV3.exactInputSingle(params);
        basket.singleCall(
            address(swap.exchange),
            abi.encodeWithSelector(
                ISwapRouter(swap.exchange).exactInput.selector,
                params
            ),
            0
        );
        emit Swaped(
            address(basket),
            swap.tokenIn,
            swap.tokenOut,
            swap.quantity,
            swap.minReturn
        );
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
        @param _swapsV3 Swaps to perform
        @param _deadline Unix timestamp after which the transaction will revert.
    */
    function rebalance(
        UniswapV2SwapStruct[] calldata _swapsV2,
        UniswapV3SwapStruct[] calldata _swapsV3,
        uint256 _deadline
    ) external override onlyRebalanceManager {
        lockBasketData(block.number + 30);

        // remove token from array
        for (uint256 i; i < _swapsV2.length; i++) {
            require(
                exchanges[_swapsV2[i].exchange] == ExchangeType.UniswapV2,
                "NOT_UNISWAP_V2"
            );

            //swap token
            _swapUniswapV2(_swapsV2[i], address(basket), _deadline);

            //add to token if missing
            addToken(_swapsV2[i].path[_swapsV2[i].path.length - 1]);

            //remove from token if resulting quantity is 0
            removeToken(_swapsV2[i].path[0]);
        }

        for (uint256 i; i < _swapsV3.length; i++) {
            require(
                exchanges[_swapsV3[i].exchange] == ExchangeType.UniswapV3,
                "NOT_UNISWAP_V3"
            );

            //swap token
            _swapUniswapV3(_swapsV3[i], address(basket), _deadline);

            //add to token if missing
            addToken(_swapsV3[i].tokenOut);

            //remove from token if resulting quantity is 0
            removeToken(_swapsV3[i].tokenIn);
        }
        emit Rebalanced(address(basket));
    }
}
