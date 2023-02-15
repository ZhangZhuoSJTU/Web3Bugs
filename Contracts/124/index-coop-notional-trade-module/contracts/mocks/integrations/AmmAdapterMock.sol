/*
    Copyright 2020 Set Labs Inc.

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

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title AmmAdapterMock
 * @author Set Protocol
 *
 * AMM Module that doubles as a mock AMM as well. This AMM is built to mimic Balancer
 */
contract AmmAdapterMock is ERC20 {
    IERC20[] public poolTokens;

    bool public returnLessThanMinimum;

    address public approvedToken;

    /* ============ Constructor ============ */
    constructor(IERC20[] memory _poolTokens) public ERC20("AMMAdapter", "AMM") {
        poolTokens = _poolTokens;
    }

    /* ============ AMM Functions ============ */

    function joinPool(uint256 poolAmountOut, uint256[] calldata maxAmountsIn) external {
        for (uint256 i = 0; i < maxAmountsIn.length; i++) {
            poolTokens[i].transferFrom(msg.sender, address(this), maxAmountsIn[i]);
        }

        uint256 mintQuantity = returnLessThanMinimum ? poolAmountOut - 1 : poolAmountOut;
        _mint(msg.sender, mintQuantity);
    }

    function exitPool(uint256 poolAmountIn, uint256[] calldata minAmountsOut) external {
        _burn(msg.sender, poolAmountIn);

        for (uint256 i = 0; i < minAmountsOut.length; i++) {
            uint256 returnQuantity = returnLessThanMinimum ? minAmountsOut[i] - 1 : minAmountsOut[i];
            poolTokens[i].transfer(msg.sender, returnQuantity);
        }
    }

    function joinswapPoolAmountOut(
        IERC20 tokenIn,
        uint256 poolAmountOut,
        uint256 maxAmountIn
    ) external {
        tokenIn.transferFrom(msg.sender, address(this), maxAmountIn);

        uint256 poolAmount = returnLessThanMinimum ? poolAmountOut - 1 : poolAmountOut;
        _mint(msg.sender, poolAmount);
    }

    function exitswapPoolAmountIn(
        IERC20 tokenOut,
        uint256 poolAmountIn,
        uint256 minAmountOut
    ) external {
        _burn(msg.sender, poolAmountIn);

        uint256 amountOut = returnLessThanMinimum ? minAmountOut - 1 : minAmountOut;
        tokenOut.transfer(msg.sender, amountOut);
    }

    /* ============ Adapter Functions ============ */

    function getProvideLiquidityCalldata(
        address /* _setToken */,
        address _pool,
        address[] calldata _components,
        uint256[] calldata _maxTokensIn,
        uint256 _minLiquidity
    )
        external
        view
        returns (address _target, uint256 _value, bytes memory _calldata)
    {
        isValidPool(_pool, _components);

        // Check that components match the pool tokens

        bytes memory callData = abi.encodeWithSignature("joinPool(uint256,uint256[])", _minLiquidity, _maxTokensIn);
        return (address(this), 0, callData);
    }

    function getProvideLiquiditySingleAssetCalldata(
        address /* _setToken */,
        address _pool,
        address _component,
        uint256 _maxTokenIn,
        uint256 _minLiquidity
    ) external view returns (address _target, uint256 _value, bytes memory _calldata) {

        address[] memory components = new address[](1);
        components[0] = _component;

        // This address must be the pool
        isValidPool(_pool, components);

        bytes memory callData = abi.encodeWithSignature(
            "joinswapPoolAmountOut(address,uint256,uint256)",
            _component,
            _minLiquidity,
            _maxTokenIn
        );
        return (address(this), 0, callData);
    }

    function getRemoveLiquidityCalldata(
        address /* _setToken */,
        address _pool,
        address[] calldata _components,
        uint256[] calldata _minTokensOut,
        uint256 _liquidity
    ) external view returns (address _target, uint256 _value, bytes memory _calldata) {
        // Validate the pool and components are legit?
        isValidPool(_pool, _components);

        bytes memory callData = abi.encodeWithSignature("exitPool(uint256,uint256[])", _liquidity, _minTokensOut);
        return (address(this), 0, callData);
    }

    function getRemoveLiquiditySingleAssetCalldata(
        address /* _setToken */,
        address _pool,
        address _component,
        uint256 _minTokenOut,
        uint256 _liquidity
    ) external view returns (address _target, uint256 _value, bytes memory _calldata) {

        address[] memory components = new address[](1);
        components[0] = _component;

        // Pool must be this address
        isValidPool(_pool, components);

        bytes memory callData = abi.encodeWithSignature(
            "exitswapPoolAmountIn(address,uint256,uint256)",
            _component,
            _liquidity,
            _minTokenOut
        );
        return (address(this), 0, callData);
    }
    
    function isValidPool(address _pool,address[] memory /*_components*/) public view returns(bool) {
        return _pool == address(this) || _pool == approvedToken;
    }

    function getSpenderAddress(address /* _pool */) external view returns(address) {
        return address(this);
    }

    /* ============ Test Functions ============ */
    function mintTo(address _to, uint256 _quantity) external {
        _mint(_to, _quantity);
    }

    function setMintLessThanMinimum() external {
        returnLessThanMinimum = !returnLessThanMinimum;
    }

    function setApprovedToken(address _token) external {
        approvedToken = _token;
    }
}