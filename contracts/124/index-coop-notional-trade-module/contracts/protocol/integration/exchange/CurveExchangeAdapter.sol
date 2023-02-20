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
 * @title CurveExchangeAdapter
 * @author FlattestWhite
 *
 * Exchange adapter for Curve pools for ERC20 <-> ERC20
 * exchange contracts. This contract assumes that all tokens
 * being traded are ERC20 tokens.
 *
 * This contract is intended to be used by trade modules to rebalance
 * SetTokens that hold ERC20 tokens as part of its components.
 */
contract CurveExchangeAdapter {

    using SafeMath for uint256;
    using PreciseUnitMath for uint256;

    /* ========= State Variables ========= */

    // Address of ERC20 tokenA
    IERC20 immutable public tokenA;                        
    // Address of ERC20 tokenB
    IERC20 immutable public tokenB;                      
    // Index of tokenA
    int128 immutable public tokenAIndex;
    // Index of tokenB
    int128 immutable public tokenBIndex;
    // Address of Curve tokenA/tokenB stableswap pool.
    IStableSwapPool immutable public stableswap;

    /* ========= Constructor ========== */

    /**
     * Set state variables
     *
     * @param _tokenA           Address of tokenA
     * @param _tokenB           Address of tokenB
     * @param _tokenAIndex      Index of tokenA in stableswap pool
     * @param _tokenBIndex      Index of tokenB in stableswap pool
     * @param _stableswap       Address of Curve Stableswap pool
     */
    constructor(
        IERC20 _tokenA,
        IERC20 _tokenB,
        int128 _tokenAIndex,
        int128 _tokenBIndex,
        IStableSwapPool _stableswap
    )
        public
    {
        require(_stableswap.coins(uint256(_tokenAIndex)) == address(_tokenA), "Stableswap pool has invalid index for tokenA");
        require(_stableswap.coins(uint256(_tokenBIndex)) == address(_tokenB), "Stableswap pool has invalid index for tokenB");

        tokenA = _tokenA;
        tokenB = _tokenB;
        tokenAIndex = _tokenAIndex;
        tokenBIndex = _tokenBIndex;
        stableswap = _stableswap;

        _tokenA.approve(address(_stableswap), PreciseUnitMath.maxUint256());
        _tokenB.approve(address(_stableswap), PreciseUnitMath.maxUint256());
    }

    /* ============ External Getter Functions ============ */ 

    /**
     * Calculate Curve trade encoded calldata. To be invoked on the SetToken.
     *
     * @param _sourceToken                  The input token.
     * @param _destinationToken             The output token.
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
        require(_sourceToken != _destinationToken, "_sourceToken must not be the same as _destinationToken");
        require(_sourceToken == address(tokenA) || _sourceToken == address(tokenB), "Invalid sourceToken");
        require(_destinationToken == address(tokenA) || _destinationToken == address(tokenB), "Invalid destinationToken");

        bytes memory callData = abi.encodeWithSignature("trade(address,address,uint256,uint256,address)",
            _sourceToken,
            _destinationToken,
            _sourceQuantity,
            _minDestinationQuantity,
            _destinationAddress
        );
        return (address(this), 0, callData);
    }

    /* ============ External Functions ============ */ 

    /**
     * Invokes an exchange on Curve Stableswap pool. To be invoked on the SetToken.
     *
     * @param _sourceToken                  The input token.
     * @param _destinationToken             The output token.
     * @param _sourceQuantity               Amount of input token.
     * @param _minDestinationQuantity       The minimum amount of output token to be received.
     * @param _destinationAddress           The address where the proceeds of the output is sent to.
     */
    function trade(
        address _sourceToken,
        address _destinationToken,
        uint256 _sourceQuantity,
        uint256 _minDestinationQuantity,
        address _destinationAddress
    ) external {
        require(_sourceToken != _destinationToken, "_sourceToken must not be the same as _destinationToken");
        if (_sourceToken == address(tokenA) && _destinationToken == address(tokenB)) {
            // Transfers sourceToken
            IERC20(_sourceToken).transferFrom(msg.sender, address(this), _sourceQuantity);

            // Exchange sourceToken for destinationToken
            uint256 amountOut = stableswap.exchange(tokenAIndex, tokenBIndex, _sourceQuantity, _minDestinationQuantity);

            // Transfer destinationToken to destinationAddress
            IERC20(_destinationToken).transfer(_destinationAddress, amountOut);
        } else if (_sourceToken == address(tokenB) && _destinationToken == address(tokenA)) {
            // Transfers sourceToken
            IERC20(_sourceToken).transferFrom(msg.sender, address(this), _sourceQuantity);

            // Exchange sourceToken for destinationToken
            uint256 amountOut = stableswap.exchange(tokenBIndex, tokenAIndex, _sourceQuantity, _minDestinationQuantity) ;
            
            // Transfer destinationToken to destinationAddress
            IERC20(_destinationToken).transfer(_destinationAddress, amountOut);
        } else {
            revert("Invalid _sourceToken or _destinationToken or both");
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
}
