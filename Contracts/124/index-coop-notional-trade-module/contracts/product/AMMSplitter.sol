/*
    Copyright 2021 Set Labs Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    SPDX-License-Identifier: Apache License, Version 2.0
*/

pragma solidity 0.6.10;
pragma experimental "ABIEncoderV2";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { IUniswapV2Factory } from "../interfaces/external/IUniswapV2Factory.sol";
import { IUniswapV2Router } from "../interfaces/external/IUniswapV2Router.sol";
import { PreciseUnitMath } from "../lib/PreciseUnitMath.sol";

/**
 * @title AMMSplitter
 * @author Set Protocol
 *
 * Peripheral contract which splits trades efficiently between Uniswap V2 and Sushiswap. Works for both exact input 
 * and exact output trades. This contract adheres to the IUniswapV2Router interface, so it can work with existing contracts that
 * expect the Uniswap router. All math for calculating the optimal split is performed on-chain. This contract only supports
 * trade paths a max length of three because with two hops, we have a common unit (the middle token), to measure the pool sizes in.
 * Additionally, the math to calculate the optimal split for greater than two hops becomes increasingly complex.
 */
contract AMMSplitter {

    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using PreciseUnitMath for uint256;

    /* ============ Structs ============== */

    struct TradeInfo {
        uint256 uniSize;        // Uniswap trade size (can be either input or output depending on context)
        uint256 sushiSize;      // Sushiswap trade size (can be either input or output depending on context)
    }

    /* ============= Events ================= */

    event TradeExactInputExecuted(
        address indexed _sendToken,
        address indexed _receiveToken,
        address indexed _to,
        uint256 _amountIn,
        uint256 _amountOut,
        uint256 _uniTradeSize,
        uint256 _sushiTradeSize
    );

    event TradeExactOutputExecuted(
        address indexed _sendToken,
        address indexed _receiveToken,
        address indexed _to,
        uint256 _amountIn,
        uint256 _amountOut,
        uint256 _uniTradeSize,
        uint256 _sushiTradeSize
    );

    /* ============ State Variables ============ */

    // address of the Uniswap Router contract
    IUniswapV2Router public immutable uniRouter;
    // address of the Sushiswap Router contract
    IUniswapV2Router public immutable sushiRouter;
    // address of the Uniswap Factory contract
    IUniswapV2Factory public immutable uniFactory;
    // address of the Sushiswap Factory contract
    IUniswapV2Factory public immutable sushiFactory;

    /* =========== Constructor =========== */

    /**
     * Sets state variables
     *
     * @param _uniRouter        the Uniswap router contract
     * @param _sushiRouter      the Sushiswap router contract
     * @param _uniFactory       the Uniswap factory contract 
     * @param _sushiFactory     the Sushiswap factory contract
     */
    constructor(
        IUniswapV2Router _uniRouter,
        IUniswapV2Router _sushiRouter,
        IUniswapV2Factory _uniFactory,
        IUniswapV2Factory _sushiFactory
    )
        public
    {
        uniRouter = _uniRouter;
        sushiRouter = _sushiRouter;
        uniFactory = _uniFactory;
        sushiFactory = _sushiFactory;
    }

    /* ============ External Functions ============= */

    /**
     * Executes an exact input trade split between Uniswap and Sushiswap. This function is for when one wants to trade with the optimal split between Uniswap 
     * and Sushiswap. This function's interface matches the Uniswap V2 swapExactTokensForTokens function. Input/output tokens are inferred implicitly from
     * the trade path with first token as input and last as output.
     *
     * @param _amountIn     the exact input amount
     * @param _amountOutMin the minimum output amount that must be received
     * @param _path         the path to use for the trade (length must be 3 or less so we can measure the pool size in units of the middle token for 2 hops)
     * @param _to           the address to direct the outputs to
     * @param _deadline     the deadline for the trade
     * 
     * @return totalOutput  the actual output amount
     */
    function swapExactTokensForTokens(
        uint256 _amountIn,
        uint256 _amountOutMin,
        address[] calldata _path,
        address _to,
        uint256 _deadline
    )
        external
        returns (uint256 totalOutput)
    {
        _checkPath(_path);

        IERC20 inputToken = IERC20(_path[0]);
        inputToken.safeTransferFrom(msg.sender, address(this), _amountIn);
        
        TradeInfo memory tradeInfo = _getTradeSizes(_path, _amountIn);

        _checkApprovals(tradeInfo.uniSize, tradeInfo.sushiSize, inputToken);

        uint256 uniOutput = _executeTrade(uniRouter, tradeInfo.uniSize, _path, _to, _deadline, true);
        uint256 sushiOutput = _executeTrade(sushiRouter, tradeInfo.sushiSize, _path, _to, _deadline, true);

        totalOutput = uniOutput.add(sushiOutput);
        require(totalOutput >= _amountOutMin, "AMMSplitter: INSUFFICIENT_OUTPUT_AMOUNT");

        emit TradeExactInputExecuted(
            _path[0],
            _path[_path.length.sub(1)],
            _to,
            _amountIn,
            totalOutput,
            tradeInfo.uniSize,
            tradeInfo.sushiSize
        );
    }

    /**
     * Executes an exact output trade split between Uniswap and Sushiswap. This function is for when one wants to trade with the optimal split between Uniswap 
     * and Sushiswap. This function's interface matches the Uniswap V2 swapTokensForExactTokens function. Input/output tokens are inferred implicitly from
     * the trade path with first token as input and last as output.
     *
     * @param _amountOut    the exact output amount
     * @param _amountInMax  the maximum input amount that can be spent
     * @param _path         the path to use for the trade (length must be 3 or less so we can measure the pool size in units of the middle token for 2 hops)
     * @param _to           the address to direct the outputs to
     * @param _deadline     the deadline for the trade
     * 
     * @return totalInput   the actual input amount
     */
    function swapTokensForExactTokens(
        uint256 _amountOut,
        uint256 _amountInMax,
        address[] calldata _path,
        address _to,
        uint256 _deadline
    )
        external
        returns (uint256 totalInput)
    {
        _checkPath(_path);

        TradeInfo memory tradeInfo = _getTradeSizes(_path, _amountOut);

        uint256 expectedUniInput = _getTradeInputOrOutput(uniRouter, tradeInfo.uniSize, _path, false)[0];
        uint256 expectedSushiInput = _getTradeInputOrOutput(sushiRouter, tradeInfo.sushiSize, _path, false)[0];

        totalInput = expectedUniInput.add(expectedSushiInput);
        // expected inputs are guaranteed to equal the actual inputs so we can revert early and save gas
        require(totalInput <= _amountInMax, "AMMSplitter: INSUFFICIENT_INPUT_AMOUNT");

        IERC20 inputToken = IERC20(_path[0]);
        inputToken.safeTransferFrom(msg.sender, address(this), totalInput);

        _checkApprovals(expectedUniInput, expectedSushiInput, inputToken);

        // total trade inputs here are guaranteed to equal totalInput calculated above so no check needed
        _executeTrade(uniRouter, tradeInfo.uniSize, _path, _to, _deadline, false);
        _executeTrade(sushiRouter, tradeInfo.sushiSize, _path, _to, _deadline, false);

        emit TradeExactOutputExecuted(
            _path[0],
            _path[_path.length.sub(1)],
            _to,
            totalInput,
            _amountOut,
            tradeInfo.uniSize,
            tradeInfo.sushiSize
        );
    }

    /* =========== External Getter Functions =========== */

    /**
     * Returns a quote with an estimated trade output amount
     *
     * @param _amountIn     input amount
     * @param _path         the trade path to use
     *
     * @return uint256[]    array of input amounts, intermediary amounts, and output amounts
     */
    function getAmountsOut(uint256 _amountIn, address[] calldata _path) external view returns (uint256[] memory) {
        return _getAmounts(_amountIn, _path, true);
    }

    /**
     * Returns a quote with an estimated trade input amount
     *
     * @param _amountOut    output amount
     * @param _path         the trade path to use
     *
     * @return uint256[]    array of input amounts, intermediary amounts, and output amounts
     */
    function getAmountsIn(uint256 _amountOut, address[] calldata _path) external view returns (uint256[] memory) {
        return _getAmounts(_amountOut, _path, false);
    }

    /* ============= Internal Functions ============ */

    /**
     * Helper function for getting trade quotes
     *
     * @param _size             input or output amount depending on _isExactInput
     * @param _path             trade path to use
     * @param _isExactInput     whether an exact input or an exact output trade quote is needed
     *
     * @return amounts          array of input amounts, intermediary amounts, and output amounts
     */
    function _getAmounts(uint256 _size, address[] calldata _path, bool _isExactInput) internal view returns (uint256[] memory amounts) {

        _checkPath(_path);

        TradeInfo memory tradeInfo = _getTradeSizes(_path, _size);

        uint256[] memory uniTradeResults = _getTradeInputOrOutput(uniRouter, tradeInfo.uniSize, _path, _isExactInput);
        uint256[] memory sushiTradeResults = _getTradeInputOrOutput(sushiRouter, tradeInfo.sushiSize, _path, _isExactInput);

        amounts = new uint256[](_path.length);
        for (uint256 i = 0; i < amounts.length; i++) {
            amounts[i] = uniTradeResults[i].add(sushiTradeResults[i]);
        }
    }

    /**
     * Calculates the optimal trade sizes for Uniswap and Sushiswap. Pool values must be measured in the same token. For single hop trades
     * this is the balance of the output token. For two hop trades, it is measured as the balance of the intermediary token. The equation to
     * calculate the ratio for two hop trades is documented under _calculateTwoHopRatio. For single hop trades, this equation is:
     *
     * Tu/Ts = Pu / Ps
     *
     * Tu = Uniswap trade size
     * Ts = Sushiswap trade size
     * Pu = Uniswap pool size
     * Ps = Sushiswap pool size
     *
     * @param _path         the trade path that will be used
     * @param _size         the total size of the trade
     *
     * @return tradeInfo    TradeInfo struct containing Uniswap and Sushiswap trade sizes
     */
    function _getTradeSizes(address[] calldata _path, uint256 _size) internal view returns (TradeInfo memory tradeInfo) {

        uint256 uniPercentage;
        if (_path.length == 2) {

            uint256 uniLiqPool = _getTokenBalanceInPair(uniFactory, _path[0], _path[1]);
            uint256 sushiLiqPool = _getTokenBalanceInPair(sushiFactory, _path[0], _path[1]);

            uniPercentage = uniLiqPool.preciseDiv(uniLiqPool.add(sushiLiqPool));
        } else {

            // always get the amount of the intermediate asset, so we have value measured in the same units for both pool A and B
            uint256 uniLiqPoolA = _getTokenBalanceInPair(uniFactory, _path[0], _path[1]);
            uint256 uniLiqPoolB = _getTokenBalanceInPair(uniFactory, _path[2], _path[1]);

            // returning early here saves gas and prevents division by zero errors later on
            if(uniLiqPoolA == 0 || uniLiqPoolB == 0) return TradeInfo(0, _size);

            // always get the amount of the intermediate asset, so we have value measured in the same units for both pool A and B
            uint256 sushiLiqPoolA = _getTokenBalanceInPair(sushiFactory, _path[0], _path[1]);
            uint256 sushiLiqPoolB = _getTokenBalanceInPair(sushiFactory, _path[2], _path[1]);

            // returning early here saves gas and prevents division by zero errors later on
            if(sushiLiqPoolA == 0 || sushiLiqPoolB == 0) return TradeInfo(_size, 0);

            uint256 ratio = _calculateTwoHopRatio(uniLiqPoolA, uniLiqPoolB, sushiLiqPoolA, sushiLiqPoolB);
            // to go from a ratio to percentage we must calculate: ratio / (ratio + 1). This percentage is measured in precise units
            uniPercentage = ratio.preciseDiv(ratio.add(PreciseUnitMath.PRECISE_UNIT));
        }

        tradeInfo.uniSize = _size.preciseMul(uniPercentage);
        tradeInfo.sushiSize = _size.sub(tradeInfo.uniSize);
    }

    /**
     * Calculates the optimal ratio of Uniswap trade size to Sushiswap trade size. To calculate the ratio between Uniswap
     * and Sushiswap use: 
     *
     * Tu/Ts = ((Psa + Psb) * Pua * Pub) / ((Pua + Pub) * Psa * Psb)
     *
     * Ts  = Sushiswap trade size
     * Tu  = Uniswap trade size
     * Pua = Uniswap liquidity for pool A
     * Pub = Uniswap liquidity for pool B
     * Psa = Sushiswap liquidity for pool A
     * Psb = Sushiswap liquidity for pool B
     *
     * This equation is derived using several assumptions. First, it assumes that the price impact is equal to 2T / P where T is
     * equal to the trade size, and P is equal to the pool size. This approximation holds given that the price impact is a small percentage.
     * The second approximation made is that when executing trades that utilize multiple hops, total price impact is the sum of each
     * hop's price impact (not accounting for the price impact of the prior trade). This approximation again holds true under the assumption
     * that the total price impact is a small percentage. The full derivation of this equation can be viewed in STIP-002.
     *
     * @param _uniLiqPoolA        Size of the first Uniswap pool
     * @param _uniLiqPoolB        Size of the second Uniswap pool
     * @param _sushiLiqPoolA      Size of the first Sushiswap pool
     * @param _sushiLiqPoolB      Size of the second Sushiswap pool
     *
     * @return uint256          the ratio of Uniswap trade size to Sushiswap trade size
     */
    function _calculateTwoHopRatio(
        uint256 _uniLiqPoolA,
        uint256 _uniLiqPoolB,
        uint256 _sushiLiqPoolA,
        uint256 _sushiLiqPoolB
    ) 
        internal
        pure
        returns (uint256)
    {
        uint256 a = _sushiLiqPoolA.add(_sushiLiqPoolB).preciseDiv(_uniLiqPoolA.add(_uniLiqPoolB));
        uint256 b = _uniLiqPoolA.preciseDiv(_sushiLiqPoolA);
        uint256 c = _uniLiqPoolB.preciseDiv(_sushiLiqPoolB);

        return a.preciseMul(b).preciseMul(c);
    }

    /**
     * Checks the token approvals to the Uniswap and Sushiswap routers are sufficient. If not
     * it bumps the allowance to MAX_UINT_256.
     *
     * @param _uniAmount    Uniswap input amount
     * @param _sushiAmount  Sushiswap input amount
     * @param _token        Token being traded
     */
    function _checkApprovals(uint256 _uniAmount, uint256 _sushiAmount, IERC20 _token) internal {
        if (_token.allowance(address(this), address(uniRouter)) < _uniAmount) {
            _token.approve(address(uniRouter), PreciseUnitMath.MAX_UINT_256);
        }
        if (_token.allowance(address(this), address(sushiRouter)) < _sushiAmount) {
            _token.approve(address(sushiRouter), PreciseUnitMath.MAX_UINT_256);
        }
    }

    /**
     * Confirms that the path length is either two or three. Reverts if it does not fall within these bounds. When paths are greater than three in 
     * length, the calculation for the optimal split between Uniswap and Sushiswap becomes much more difficult, so it is disallowed.
     *
     * @param _path     trade path to check
     */
    function _checkPath(address[] calldata _path) internal pure {
        require(_path.length == 2 || _path.length == 3, "AMMSplitter: incorrect path length");
    }

    /**
     * Gets the balance of a component token in a Uniswap / Sushiswap pool
     *
     * @param _factory          factory contract to use (either uniFactory or sushiFactory)
     * @param _pairedToken      first token in pair
     * @param _balanceToken     second token in pair, and token to get balance of
     *
     * @return uint256          balance of second token in pair
     */
    function _getTokenBalanceInPair(IUniswapV2Factory _factory, address _pairedToken, address _balanceToken) internal view returns (uint256) {
        address uniPair = _factory.getPair(_pairedToken, _balanceToken);
        return IERC20(_balanceToken).balanceOf(uniPair);
    }

    /**
     * Executes a trade on Uniswap or Sushiswap. If passed a trade size of 0, skip the
     * trade.
     *
     * @param _router           The router to execute the trade through (either Uniswap or Sushiswap)
     * @param _size             Input amount if _isExactInput is true, output amount if false
     * @param _path             Path for the trade
     * @param _to               Address to redirect trade output to
     * @param _deadline         Timestamp that trade must execute before
     * @param _isExactInput     Whether to perform an exact input or exact output swap
     *
     * @return uint256          the actual input / output amount of the trade
     */
    function _executeTrade(
        IUniswapV2Router _router,
        uint256 _size,
        address[] calldata _path,
        address _to,
        uint256 _deadline,
        bool _isExactInput
    ) 
        internal
        returns (uint256)
    {
        if (_size == 0) return 0;
        
        // maxInput or minOutput not checked here. The sum all inputs/outputs is instead checked after all trades execute
        if (_isExactInput) {
            return _router.swapExactTokensForTokens(_size, 0, _path, _to, _deadline)[_path.length.sub(1)];
        } else {
            return _router.swapTokensForExactTokens(_size, uint256(-1), _path, _to, _deadline)[0];
        }
    }

    /**
     * Gets a trade quote on Uniswap or Sushiswap
     *
     * @param _router           The router to get the quote from (either Uniswap or Sushiswap)
     * @param _size             Input amount if _isExactInput is true, output amount if false
     * @param _path             Path for the trade
     * @param _isExactInput     Whether to get a getAmountsIn or getAmountsOut quote
     *
     * @return uint256[]        Array of input amounts, intermediary amounts, and output amounts
     */
    function _getTradeInputOrOutput(
        IUniswapV2Router _router,
        uint256 _size,
        address[] calldata _path,
        bool _isExactInput
    )
        internal
        view
        returns (uint256[] memory)
    {
        // if trade size is zero return an array of all zeros to prevent a revert
        if (_size == 0) return new uint256[](_path.length);

        if(_isExactInput) {
            return _router.getAmountsOut(_size, _path);
        } else {
            return _router.getAmountsIn(_size, _path);
        }
    }
}
