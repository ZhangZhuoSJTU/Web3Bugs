/*
    Copyright 2022 Set Labs Inc.
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
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { IStableSwapPool } from "../../../interfaces/external/IStableSwapPool.sol";
import { IWETH } from "../../../interfaces/external/IWETH.sol";
import { PreciseUnitMath } from "../../../lib/PreciseUnitMath.sol";

/**
 * @title CurveStEthExchangeAdapter
 * @author FlattestWhite & ncitron
 *
 * Exchange adapter for the specialized Curve stETH <-> ETH
 * exchange contracts. Implements helper functionality for
 * wrapping and unwrapping WETH since the curve exchange uses
 * raw ETH.
 *
 * This contract is intended to be used by trade modules to rebalance
 * SetTokens that hold stETH as part of its components.
 */
contract CurveStEthExchangeAdapter {

    using SafeMath for uint256;
    using PreciseUnitMath for uint256;

    /* ========= State Variables ========= */

    // Address of WETH token.
    IWETH immutable public weth;                        
    // Address of stETH token.
    IERC20 immutable public stETH;                      
    // Address of Curve Eth/StEth stableswap pool.
    IStableSwapPool immutable public stableswap;
    // Index for ETH for Curve stableswap pool.
    int128 internal constant ETH_INDEX = 0;            
    // Index for stETH for Curve stableswap pool.
    int128 internal constant STETH_INDEX = 1;          

    /* ========= Constructor ========== */

    /**
     * Set state variables
     *
     * @param _weth             Address of WETH token
     * @param _stETH            Address of stETH token
     * @param _stableswap       Address of Curve Eth/StEth Stableswap pool
     */
    constructor(
        IWETH _weth,
        IERC20 _stETH,
        IStableSwapPool _stableswap
    )
        public
    {
        weth = _weth;
        stETH = _stETH;
        stableswap = _stableswap;

        require(_stableswap.coins(0) == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE, "Stableswap pool has invalid ETH_INDEX");
        require(_stableswap.coins(1) == address(_stETH), "Stableswap pool has invalid STETH_INDEX");

        _stETH.approve(address(_stableswap), PreciseUnitMath.maxUint256());
    }

    /* ======== External Functions ======== */

    /**
     * Buys stEth using WETH
     *
     * @param _sourceQuantity               The amount of WETH as input.
     * @param _minDestinationQuantity       The minimum amounnt of stETH to receive.
     * @param _destinationAddress           The address to send the trade proceeds to.
     */
    function buyStEth(
        uint256 _sourceQuantity,
        uint256 _minDestinationQuantity,
        address _destinationAddress
    )
        external
    {
        // transfer weth
        weth.transferFrom(msg.sender, address(this), _sourceQuantity);

        // unwrap weth
        weth.withdraw(_sourceQuantity);

        // buy stETH
        uint256 amountOut = stableswap.exchange{value: _sourceQuantity} (
            ETH_INDEX,
            STETH_INDEX,
            _sourceQuantity,
            _minDestinationQuantity
        );

        // transfer proceeds
        stETH.transfer(_destinationAddress, amountOut);
    }

    /**
     * Sells stETH for WETH
     * 
     * @param _sourceQuantity               The amount of stETH as input.
     * @param _minDestinationQuantity       The minimum amount of WETH to receive.
     * @param _destinationAddress           The address to send the trade proceeds to.
     */
    function sellStEth(
        uint256 _sourceQuantity,
        uint256 _minDestinationQuantity,
        address _destinationAddress
    )
        external
    {
        // transfer stETH
        stETH.transferFrom(msg.sender, address(this), _sourceQuantity);

        // sell stETH
        uint256 amountOut = stableswap.exchange(STETH_INDEX, ETH_INDEX, _sourceQuantity, _minDestinationQuantity);

        // wrap eth
        weth.deposit{value: amountOut}();

        // transfer proceeds
        weth.transfer(_destinationAddress, amountOut);
    }

    /* ============ External Getter Functions ============ */ 

    /**
     * Calculate Curve trade encoded calldata. To be invoked on the SetToken.
     *
     * @param _sourceToken                  Either WETH or stETH. The input token.
     * @param _destinationToken             Either WETH or stETH. The output token.
     * @param _destinationAddress           The address where the proceeds of the output is sent to.
     * @param _sourceQuantity               Amount of input token.
     * @param _minDestinationQuantity       The minimum amount of output token to be received.
     *
     * @return address                      Target contract address
     * @return uint256                      Call value
     * @return bytes                        Trade calldata
     */
    function getTradeCalldata(
        address _sourceToken,
        address _destinationToken,
        address _destinationAddress,
        uint256 _sourceQuantity,
        uint256 _minDestinationQuantity,
        bytes memory /* data */
    )
        external
        view
        returns (address, uint256, bytes memory)
    {
        if (_sourceToken == address(weth) && _destinationToken == address(stETH)) {
            bytes memory callData = abi.encodeWithSignature(
                "buyStEth(uint256,uint256,address)",
                _sourceQuantity,
                _minDestinationQuantity,
                _destinationAddress
            );
            return (address(this), 0, callData);
        } else if (_sourceToken == address(stETH) && _destinationToken == address(weth)) {
            bytes memory callData = abi.encodeWithSignature(
                "sellStEth(uint256,uint256,address)",
                _sourceQuantity,
                _minDestinationQuantity,
                _destinationAddress
            );
            return (address(this), 0, callData);
        } else {
            revert("Must swap between weth and stETH");
        }
    }

    /**
     * Returns the address to approve source tokens to for trading. In this case, the address of this contract.
     *
     * @return address             Address of the contract to approve tokens to.
     */
    function getSpender() external view returns (address) {
        return address(this);
    }

    /**
     * This function is invoked when:
     * 1. WETH is withdrawn for ETH.
     * 2. ETH is received from Curve stableswap pool on exchange call.
     */
    receive() external payable {}
}
