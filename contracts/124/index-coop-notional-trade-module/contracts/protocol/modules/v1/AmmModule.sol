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
pragma experimental "ABIEncoderV2";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { SignedSafeMath } from "@openzeppelin/contracts/math/SignedSafeMath.sol";

import { IController } from "../../../interfaces/IController.sol";
import { IIntegrationRegistry } from "../../../interfaces/IIntegrationRegistry.sol";
import { Invoke } from "../../lib/Invoke.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { IAmmAdapter } from "../../../interfaces/IAmmAdapter.sol";
import { ModuleBase } from "../../lib/ModuleBase.sol";
import { Position } from "../../lib/Position.sol";
import { PreciseUnitMath } from "../../../lib/PreciseUnitMath.sol";


/**
 * @title AmmModule
 * @author Set Protocol
 *
 * A smart contract module that enables joining and exiting of AMM Pools using multiple or a single ERC20s.
 * Examples of intended protocols include Curve, Uniswap, and Balancer.
 */
contract AmmModule is ModuleBase, ReentrancyGuard {
    using SafeCast for int256;
    using SafeCast for uint256;
    using PreciseUnitMath for uint256;
    using Position for uint256;
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    using Invoke for ISetToken;
    using Position for ISetToken;

    /* ============ Events ============ */
    event LiquidityAdded(
        ISetToken indexed _setToken,
        address indexed _ammPool,
        int256 _ammPoolBalancesDelta,     // Change in SetToken AMM Liquidity Pool token balances
        address[] _components,
        int256[] _componentBalancesDelta  // Change in SetToken component token balances
    );

    event LiquidityRemoved(
        ISetToken indexed _setToken,
        address indexed _ammPool,
        int256 _ammPoolBalancesDelta,    // Change in AMM pool token balances
        address[] _components,
        int256[] _componentBalancesDelta // Change in SetToken component token balances
    );


    /* ============ Structs ============ */

    struct ActionInfo {
        ISetToken setToken;                         // Instance of SetToken
        uint256 totalSupply;                        // Total supply of the SetToken
        IAmmAdapter ammAdapter;                     // Instance of amm adapter contract
        address liquidityToken;                     // Address of the AMM pool token
        uint256 preActionLiquidityTokenBalance;     // Balance of liquidity token before add/remove liquidity action
        uint256[] preActionComponentBalances;       // Balance of components before add/remove liquidity action
        uint256 liquidityQuantity;                  // When adding liquidity, minimum quantity of liquidity required.
                                                    // When removing liquidity, quantity to dispose of
        uint256[] totalNotionalComponents;          // When adding liquidity, maximum components provided
                                                    // When removing liquidity, minimum components to receive
        uint256[] componentUnits;                   // List of inputted component real units
        address[] components;                       // List of component addresses for providing/removing liquidity
    }

    /* ============ Constructor ============ */

    constructor(IController _controller) public ModuleBase(_controller) {}

    /* ============ External Functions ============ */

    /**
     * SET MANAGER ONLY. Adds liquidity to an AMM pool for a specified AMM. User specifies what components and quantity of
     * components to contribute and the minimum number of liquidity pool tokens to receive.
     *
     * @param _setToken                 Address of SetToken
     * @param _ammName                  Human readable name of integration (e.g. CURVE) stored in the IntegrationRegistry
     * @param _ammPool                  Address of the AMM pool; Must be valid according to the Amm Adapter
     * @param _minPoolTokenPositionUnit Minimum number of liquidity pool tokens to receive in position units
     * @param _components               List of components to contribute as liquidity to the Amm pool
     * @param _maxComponentUnits        Quantities of components in position units to contribute
     */
    function addLiquidity(
        ISetToken _setToken,
        string memory _ammName,
        address _ammPool,
        uint256 _minPoolTokenPositionUnit,
        address[] calldata _components,
        uint256[] calldata _maxComponentUnits
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        ActionInfo memory actionInfo = _getActionInfo(
            _setToken,
            _ammName,
            _ammPool,
            _components,
            _maxComponentUnits,
            _minPoolTokenPositionUnit
        );

        _validateAddLiquidity(actionInfo);

        _executeAddLiquidity(actionInfo);

        _validateMinimumLiquidityReceived(actionInfo);

        int256[] memory componentsDelta = _updateComponentPositions(actionInfo);

        int256 liquidityTokenDelta = _updateLiquidityTokenPositions(actionInfo);

        emit LiquidityAdded(_setToken, _ammPool, liquidityTokenDelta, _components, componentsDelta);
    }

    /**
     * SET MANAGER ONLY. Adds liquidity to an AMM pool for a specified AMM using a single asset if supported.
     * Differs from addLiquidity as it will opt to use the AMMs single asset liquidity function if it exists
     * User specifies what component and component quantity to contribute and the minimum number of
     * liquidity pool tokens to receive.
     *
     * @param _setToken                 Address of SetToken
     * @param _ammName                  Human readable name of integration (e.g. CURVE) stored in the IntegrationRegistry
     * @param _ammPool                  Address of the AMM pool; Must be valid according to the Amm Adapter
     * @param _minPoolTokenPositionUnit Minimum number of liquidity pool tokens to receive in position units
     * @param _component                Component to contribute as liquidity to the Amm pool
     * @param _maxComponentUnit         Quantity of component in position units to contribute
     */
    function addLiquiditySingleAsset(
        ISetToken _setToken,
        string memory _ammName,
        address _ammPool,
        uint256 _minPoolTokenPositionUnit,
        address _component,
        uint256 _maxComponentUnit
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        ActionInfo memory actionInfo = _getActionInfoSingleAsset(
            _setToken,
            _ammName,
            _ammPool,
            _component,
            _maxComponentUnit,
            _minPoolTokenPositionUnit
        );

        _validateAddLiquidity(actionInfo);

        _executeAddLiquiditySingleAsset(actionInfo);

        _validateMinimumLiquidityReceived(actionInfo);

        int256[] memory componentsDelta = _updateComponentPositions(actionInfo);

        int256 liquidityTokenDelta = _updateLiquidityTokenPositions(actionInfo);

        emit LiquidityAdded(
            _setToken,
            _ammPool,
            liquidityTokenDelta,
            actionInfo.components,
            componentsDelta
        );
    }

    /**
     * SET MANAGER ONLY. Removes liquidity from an AMM pool for a specified AMM. User specifies the exact number of
     * liquidity pool tokens to provide and the components and minimum quantity of component units to receive
     *
     * @param _setToken                  Address of SetToken
     * @param _ammName                   Human readable name of integration (e.g. CURVE) stored in the IntegrationRegistry
     * @param _ammPool                   Address of the AMM pool; Must be valid according to the Amm Adapter
     * @param _poolTokenPositionUnits    Number of liquidity pool tokens to burn
     * @param _components                Component to receive from the AMM Pool
     * @param _minComponentUnitsReceived Minimum quantity of components in position units to receive
     */
    function removeLiquidity(
        ISetToken _setToken,
        string memory _ammName,
        address _ammPool,
        uint256 _poolTokenPositionUnits,
        address[] calldata _components,
        uint256[] calldata _minComponentUnitsReceived
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        ActionInfo memory actionInfo = _getActionInfo(
            _setToken,
            _ammName,
            _ammPool,
            _components,
            _minComponentUnitsReceived,
            _poolTokenPositionUnits
        );

        _validateRemoveLiquidity(actionInfo);

        _executeRemoveLiquidity(actionInfo);

        _validateMinimumUnderlyingReceived(actionInfo);

        int256 liquidityTokenDelta = _updateLiquidityTokenPositions(actionInfo);

        int256[] memory componentsDelta = _updateComponentPositions(actionInfo);

        emit LiquidityRemoved(
            _setToken,
            _ammPool,
            liquidityTokenDelta,
            _components,
            componentsDelta
        );
    }

    /**
     * SET MANAGER ONLY. Removes liquidity from an AMM pool for a specified AMM, receiving a single component.
     * User specifies the exact number of liquidity pool tokens to provide, the components, and minimum quantity of component
     * units to receive
     *
     * @param _setToken                  Address of SetToken
     * @param _ammName                   Human readable name of integration (e.g. CURVE) stored in the IntegrationRegistry
     * @param _ammPool                   Address of the AMM pool; Must be valid according to the Amm Adapter
     * @param _poolTokenPositionUnits    Number of liquidity pool tokens to burn
     * @param _component                 Component to receive from the AMM Pool
     * @param _minComponentUnitsReceived Minimum quantity of component in position units to receive
     */
    function removeLiquiditySingleAsset(
        ISetToken _setToken,
        string memory _ammName,
        address _ammPool,
        uint256 _poolTokenPositionUnits,
        address _component,
        uint256 _minComponentUnitsReceived
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        ActionInfo memory actionInfo = _getActionInfoSingleAsset(
            _setToken,
            _ammName,
            _ammPool,
            _component,
            _minComponentUnitsReceived,
            _poolTokenPositionUnits
        );

        _validateRemoveLiquidity(actionInfo);

        _executeRemoveLiquiditySingleAsset(actionInfo);

        _validateMinimumUnderlyingReceived(actionInfo);

        int256 liquidityTokenDelta = _updateLiquidityTokenPositions(actionInfo);

        int256[] memory componentsDelta = _updateComponentPositions(actionInfo);

        emit LiquidityRemoved(
            _setToken,
            _ammPool,
            liquidityTokenDelta,
            actionInfo.components,
            componentsDelta
        );
    }

    /**
     * Initializes this module to the SetToken. Only callable by the SetToken's manager.
     *
     * @param _setToken             Instance of the SetToken to issue
     */
    function initialize(ISetToken _setToken) external onlySetManager(_setToken, msg.sender) onlyValidAndPendingSet(_setToken) {
        _setToken.initializeModule();
    }

    /**
     * Removes this module from the SetToken, via call by the SetToken.
     */
    function removeModule() external override {}


    /* ============ Internal Functions ============ */

    function _getActionInfo(
        ISetToken _setToken,
        string memory _integrationName,
        address _ammPool,
        address[] memory _components,
        uint256[] memory _componentUnits,
        uint256 _poolTokenInPositionUnit
    )
        internal
        view
        returns (ActionInfo memory)
    {
        ActionInfo memory actionInfo;

        actionInfo.setToken = _setToken;

        actionInfo.totalSupply = _setToken.totalSupply();

        actionInfo.ammAdapter = IAmmAdapter(getAndValidateAdapter(_integrationName));

        actionInfo.liquidityToken = _ammPool;

        actionInfo.preActionLiquidityTokenBalance = IERC20(_ammPool).balanceOf(address(_setToken));

        actionInfo.preActionComponentBalances = _getTokenBalances(address(_setToken), _components);

        actionInfo.liquidityQuantity = actionInfo.totalSupply.getDefaultTotalNotional(_poolTokenInPositionUnit);

        actionInfo.totalNotionalComponents = _getTotalNotionalComponents(_setToken, _componentUnits);

        actionInfo.componentUnits = _componentUnits;

        actionInfo.components = _components;

        return actionInfo;
    }

    function _getActionInfoSingleAsset(
        ISetToken _setToken,
        string memory _integrationName,
        address _ammPool,
        address _component,
        uint256 _maxPositionUnitToPool,
        uint256 _minPoolToken
    )
        internal
        view
        returns (ActionInfo memory)
    {
        address[] memory components = new address[](1);
        components[0] = _component;

        uint256[] memory maxPositionUnitsToPool = new uint256[](1);
        maxPositionUnitsToPool[0] = _maxPositionUnitToPool;

        return _getActionInfo(
            _setToken,
            _integrationName,
            _ammPool,
            components,
            maxPositionUnitsToPool,
            _minPoolToken
        );
    }

    function _validateAddLiquidity(ActionInfo memory _actionInfo) internal view {
        _validateCommon(_actionInfo);

        for (uint256 i = 0; i < _actionInfo.components.length ; i++) {
            address component = _actionInfo.components[i];

            require(
                _actionInfo.setToken.hasSufficientDefaultUnits(component, _actionInfo.componentUnits[i]),
                "Unit cant be greater than positions owned"
            );
        }
    }

    function _validateRemoveLiquidity(ActionInfo memory _actionInfo) internal view {
        _validateCommon(_actionInfo);

        for (uint256 i = 0; i < _actionInfo.components.length ; i++) {
            require(_actionInfo.componentUnits[i] > 0, "Component quantity must be nonzero");
        }

        require(
            _actionInfo.setToken.hasSufficientDefaultUnits(_actionInfo.liquidityToken, _actionInfo.liquidityQuantity),
            "SetToken must own enough liquidity token"
        );
    }

    function _validateCommon(ActionInfo memory _actionInfo) internal view {
        require(_actionInfo.componentUnits.length == _actionInfo.components.length, "Components and units must be equal length");

        require(_actionInfo.liquidityQuantity > 0, "Token quantity must be nonzero");

        require(
            _actionInfo.ammAdapter.isValidPool(_actionInfo.liquidityToken, _actionInfo.components),
            "Pool token must be enabled on the Adapter"
        );
    }

    function _executeComponentApprovals(ActionInfo memory _actionInfo) internal {
        address spender = _actionInfo.ammAdapter.getSpenderAddress(_actionInfo.liquidityToken);

        // Loop through and approve total notional tokens to spender
        for (uint256 i = 0; i < _actionInfo.components.length ; i++) {
            _actionInfo.setToken.invokeApprove(
                _actionInfo.components[i],
                spender,
                _actionInfo.totalNotionalComponents[i]
            );
        }
    }

    function _executeAddLiquidity(ActionInfo memory _actionInfo) internal {
        (
            address targetAmm, uint256 callValue, bytes memory methodData
        ) = _actionInfo.ammAdapter.getProvideLiquidityCalldata(
            address(_actionInfo.setToken),
            _actionInfo.liquidityToken,
            _actionInfo.components,
            _actionInfo.totalNotionalComponents,
            _actionInfo.liquidityQuantity
        );

        _executeComponentApprovals(_actionInfo);

        _actionInfo.setToken.invoke(targetAmm, callValue, methodData);
    }

    function _executeAddLiquiditySingleAsset(ActionInfo memory _actionInfo) internal {
        (
            address targetAmm, uint256 callValue, bytes memory methodData
        ) = _actionInfo.ammAdapter.getProvideLiquiditySingleAssetCalldata(
            address(_actionInfo.setToken),
            _actionInfo.liquidityToken,
            _actionInfo.components[0],
            _actionInfo.totalNotionalComponents[0],
            _actionInfo.liquidityQuantity
        );

        _executeComponentApprovals(_actionInfo);

        _actionInfo.setToken.invoke(targetAmm, callValue, methodData);
    }

    function _executeRemoveLiquidity(ActionInfo memory _actionInfo) internal {
        (
            address targetAmm, uint256 callValue, bytes memory methodData
        ) = _actionInfo.ammAdapter.getRemoveLiquidityCalldata(
            address(_actionInfo.setToken),
            _actionInfo.liquidityToken,
            _actionInfo.components,
            _actionInfo.totalNotionalComponents,
            _actionInfo.liquidityQuantity
        );

        _actionInfo.setToken.invokeApprove(
            _actionInfo.liquidityToken,
            _actionInfo.ammAdapter.getSpenderAddress(_actionInfo.liquidityToken),
            _actionInfo.liquidityQuantity
        );

        _actionInfo.setToken.invoke(targetAmm, callValue, methodData);
    }

    function _executeRemoveLiquiditySingleAsset(ActionInfo memory _actionInfo) internal {
        (
            address targetAmm, uint256 callValue, bytes memory methodData
        ) = _actionInfo.ammAdapter.getRemoveLiquiditySingleAssetCalldata(
            address(_actionInfo.setToken),
            _actionInfo.liquidityToken,
            _actionInfo.components[0],
            _actionInfo.totalNotionalComponents[0],
            _actionInfo.liquidityQuantity
        );

        _actionInfo.setToken.invokeApprove(
            _actionInfo.liquidityToken,
            _actionInfo.ammAdapter.getSpenderAddress(_actionInfo.liquidityToken),
            _actionInfo.liquidityQuantity
        );

        _actionInfo.setToken.invoke(targetAmm, callValue, methodData);
    }

    function _validateMinimumLiquidityReceived(ActionInfo memory _actionInfo) internal view {
        uint256 liquidityTokenBalance = IERC20(_actionInfo.liquidityToken).balanceOf(address(_actionInfo.setToken));

        require(
            liquidityTokenBalance >= _actionInfo.liquidityQuantity.add(_actionInfo.preActionLiquidityTokenBalance),
            "Liquidity tokens received must be greater than minimum specified"
        );
    }

    function _validateMinimumUnderlyingReceived(ActionInfo memory _actionInfo) internal view {
        for (uint256 i = 0; i < _actionInfo.components.length; i++) {
            uint256 underlyingBalance = IERC20(_actionInfo.components[i]).balanceOf(address(_actionInfo.setToken));

            require(
                underlyingBalance >= _actionInfo.totalNotionalComponents[i].add(_actionInfo.preActionComponentBalances[i]),
                "Underlying tokens received must be greater than minimum specified"
            );
        }
    }

    function _updateComponentPositions(ActionInfo memory _actionInfo) internal returns(int256[] memory) {
        int256[] memory componentsReceived = new int256[](_actionInfo.components.length);

        for (uint256 i = 0; i < _actionInfo.components.length; i++) {

            (uint256 currentComponentBalance,,) = _actionInfo.setToken.calculateAndEditDefaultPosition(
                _actionInfo.components[i],
                _actionInfo.totalSupply,
                _actionInfo.preActionComponentBalances[i]
            );

            componentsReceived[i] = currentComponentBalance.toInt256()
                                        .sub(_actionInfo.preActionComponentBalances[i].toInt256());
        }

        return componentsReceived;
    }

    function _updateLiquidityTokenPositions(ActionInfo memory _actionInfo) internal returns(int256) {

        (uint256 currentLiquidityTokenBalance,,) = _actionInfo.setToken.calculateAndEditDefaultPosition(
            _actionInfo.liquidityToken,
            _actionInfo.totalSupply,
            _actionInfo.preActionLiquidityTokenBalance
        );

        return currentLiquidityTokenBalance.toInt256().sub(_actionInfo.preActionLiquidityTokenBalance.toInt256());
    }

    function _getTokenBalances(address _owner, address[] memory _tokens) internal view returns(uint256[] memory) {
        uint256[] memory tokenBalances = new uint256[](_tokens.length);
        for (uint256 i = 0; i < _tokens.length; i++) {
            tokenBalances[i] = IERC20(_tokens[i]).balanceOf(_owner);
        }
        return tokenBalances;
    }

    function _getTotalNotionalComponents(
        ISetToken _setToken,
        uint256[] memory _tokenAmounts
    )
        internal
        view
        returns(uint256[] memory)
    {
        uint256 totalSupply = _setToken.totalSupply();

        uint256[] memory totalNotionalQuantities = new uint256[](_tokenAmounts.length);
        for (uint256 i = 0; i < _tokenAmounts.length; i++) {
            totalNotionalQuantities[i] = Position.getDefaultTotalNotional(totalSupply, _tokenAmounts[i]);
        }
        return totalNotionalQuantities;
    }

}