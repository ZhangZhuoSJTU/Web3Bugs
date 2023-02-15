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
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { IController } from "../../../interfaces/IController.sol";
import { IIntegrationRegistry } from "../../../interfaces/IIntegrationRegistry.sol";
import { Invoke } from "../../lib/Invoke.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { IWETH } from "../../../interfaces/external/IWETH.sol";
import { IWrapV2Adapter } from "../../../interfaces/IWrapV2Adapter.sol";
import { ModuleBase } from "../../lib/ModuleBase.sol";
import { Position } from "../../lib/Position.sol";
import { PreciseUnitMath } from "../../../lib/PreciseUnitMath.sol";

/**
 * @title WrapModuleV2
 * @author Set Protocol
 *
 * Module that enables the wrapping of ERC20 and Ether positions via third party protocols. The WrapModuleV2
 * works in conjunction with WrapV2Adapters, in which the wrapAdapterID / integrationNames are stored on the
 * integration registry.
 *
 * Some examples of wrap actions include wrapping, DAI to cDAI (Compound) or Dai to aDai (AAVE).
 */
contract WrapModuleV2 is ModuleBase, ReentrancyGuard {
    using SafeCast for int256;
    using PreciseUnitMath for uint256;
    using Position for uint256;
    using SafeMath for uint256;

    using Invoke for ISetToken;
    using Position for ISetToken.Position;
    using Position for ISetToken;

    /* ============ Events ============ */

    event ComponentWrapped(
        ISetToken indexed _setToken,
        address indexed _underlyingToken,
        address indexed _wrappedToken,
        uint256 _underlyingQuantity,
        uint256 _wrappedQuantity,
        string _integrationName
    );

    event ComponentUnwrapped(
        ISetToken indexed _setToken,
        address indexed _underlyingToken,
        address indexed _wrappedToken,
        uint256 _underlyingQuantity,
        uint256 _wrappedQuantity,
        string _integrationName
    );

    /* ============ State Variables ============ */

    // Wrapped ETH address
    IWETH public weth;

    /* ============ Constructor ============ */

    /**
     * @param _controller               Address of controller contract
     * @param _weth                     Address of wrapped eth
     */
    constructor(IController _controller, IWETH _weth) public ModuleBase(_controller) {
        weth = _weth;
    }

    /* ============ External Functions ============ */

    /**
     * MANAGER-ONLY: Instructs the SetToken to wrap an underlying asset into a wrappedToken via a specified adapter.
     *
     * @param _setToken             Instance of the SetToken
     * @param _underlyingToken      Address of the component to be wrapped
     * @param _wrappedToken         Address of the desired wrapped token
     * @param _underlyingUnits      Quantity of underlying units in Position units
     * @param _integrationName      Name of wrap module integration (mapping on integration registry)
     * @param _wrapData             Arbitrary bytes to pass into the WrapV2Adapter
     */
    function wrap(
        ISetToken _setToken,
        address _underlyingToken,
        address _wrappedToken,
        uint256 _underlyingUnits,
        string calldata _integrationName,
        bytes memory _wrapData
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        (
            uint256 notionalUnderlyingWrapped,
            uint256 notionalWrapped
        ) = _validateWrapAndUpdate(
            _integrationName,
            _setToken,
            _underlyingToken,
            _wrappedToken,
            _underlyingUnits,
            _wrapData,
            false // does not use Ether
        );

        emit ComponentWrapped(
            _setToken,
            _underlyingToken,
            _wrappedToken,
            notionalUnderlyingWrapped,
            notionalWrapped,
            _integrationName
        );
    }

    /**
     * MANAGER-ONLY: Instructs the SetToken to wrap Ether into a wrappedToken via a specified adapter. Since SetTokens
     * only hold WETH, in order to support protocols that collateralize with Ether the SetToken's WETH must be unwrapped
     * first before sending to the external protocol.
     *
     * @param _setToken             Instance of the SetToken
     * @param _wrappedToken         Address of the desired wrapped token
     * @param _underlyingUnits      Quantity of underlying units in Position units
     * @param _integrationName      Name of wrap module integration (mapping on integration registry)
     * @param _wrapData             Arbitrary bytes to pass into the WrapV2Adapter
     */
    function wrapWithEther(
        ISetToken _setToken,
        address _wrappedToken,
        uint256 _underlyingUnits,
        string calldata _integrationName,
        bytes memory _wrapData
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        (
            uint256 notionalUnderlyingWrapped,
            uint256 notionalWrapped
        ) = _validateWrapAndUpdate(
            _integrationName,
            _setToken,
            address(weth),
            _wrappedToken,
            _underlyingUnits,
            _wrapData,
            true // uses Ether
        );

        emit ComponentWrapped(
            _setToken,
            address(weth),
            _wrappedToken,
            notionalUnderlyingWrapped,
            notionalWrapped,
            _integrationName
        );
    }

    /**
     * MANAGER-ONLY: Instructs the SetToken to unwrap a wrapped asset into its underlying via a specified adapter.
     *
     * @param _setToken             Instance of the SetToken
     * @param _underlyingToken      Address of the underlying asset
     * @param _wrappedToken         Address of the component to be unwrapped
     * @param _wrappedUnits         Quantity of wrapped tokens in Position units
     * @param _integrationName      ID of wrap module integration (mapping on integration registry)
     * @param _unwrapData           Arbitrary bytes to pass into the WrapV2Adapter
     */
    function unwrap(
        ISetToken _setToken,
        address _underlyingToken,
        address _wrappedToken,
        uint256 _wrappedUnits,
        string calldata _integrationName,
        bytes memory _unwrapData
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        (
            uint256 notionalUnderlyingUnwrapped,
            uint256 notionalUnwrapped
        ) = _validateUnwrapAndUpdate(
            _integrationName,
            _setToken,
            _underlyingToken,
            _wrappedToken,
            _wrappedUnits,
            _unwrapData,
            false // uses Ether
        );

        emit ComponentUnwrapped(
            _setToken,
            _underlyingToken,
            _wrappedToken,
            notionalUnderlyingUnwrapped,
            notionalUnwrapped,
            _integrationName
        );
    }

    /**
     * MANAGER-ONLY: Instructs the SetToken to unwrap a wrapped asset collateralized by Ether into Wrapped Ether. Since
     * external protocol will send back Ether that Ether must be Wrapped into WETH in order to be accounted for by SetToken.
     *
     * @param _setToken                 Instance of the SetToken
     * @param _wrappedToken             Address of the component to be unwrapped
     * @param _wrappedUnits             Quantity of wrapped tokens in Position units
     * @param _integrationName          ID of wrap module integration (mapping on integration registry)
     * @param _unwrapData           Arbitrary bytes to pass into the WrapV2Adapter
     */
    function unwrapWithEther(
        ISetToken _setToken,
        address _wrappedToken,
        uint256 _wrappedUnits,
        string calldata _integrationName,
        bytes memory _unwrapData
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        (
            uint256 notionalUnderlyingUnwrapped,
            uint256 notionalUnwrapped
        ) = _validateUnwrapAndUpdate(
            _integrationName,
            _setToken,
            address(weth),
            _wrappedToken,
            _wrappedUnits,
            _unwrapData,
            true // uses Ether
        );

        emit ComponentUnwrapped(
            _setToken,
            address(weth),
            _wrappedToken,
            notionalUnderlyingUnwrapped,
            notionalUnwrapped,
            _integrationName
        );
    }

    /**
     * Initializes this module to the SetToken. Only callable by the SetToken's manager.
     *
     * @param _setToken             Instance of the SetToken to issue
     */
    function initialize(ISetToken _setToken) external onlySetManager(_setToken, msg.sender) {
        require(controller.isSet(address(_setToken)), "Must be controller-enabled SetToken");
        require(isSetPendingInitialization(_setToken), "Must be pending initialization");
        _setToken.initializeModule();
    }

    /**
     * Removes this module from the SetToken, via call by the SetToken.
     */
    function removeModule() external override {}


    /* ============ Internal Functions ============ */

    /**
     * Validates the wrap operation is valid. In particular, the following checks are made:
     * - The position is Default
     * - The position has sufficient units given the transact quantity
     * - The transact quantity > 0
     *
     * It is expected that the adapter will check if wrappedToken/underlyingToken are a valid pair for the given
     * integration.
     */
    function _validateInputs(
        ISetToken _setToken,
        address _transactPosition,
        uint256 _transactPositionUnits
    )
        internal
        view
    {
        require(_transactPositionUnits > 0, "Target position units must be > 0");
        require(_setToken.hasDefaultPosition(_transactPosition), "Target default position must be component");
        require(
            _setToken.hasSufficientDefaultUnits(_transactPosition, _transactPositionUnits),
            "Unit cant be greater than existing"
        );
    }

    /**
     * The WrapModule calculates the total notional underlying to wrap, approves the underlying to the 3rd party
     * integration contract, then invokes the SetToken to call wrap by passing its calldata along. When raw ETH
     * is being used (_usesEther = true) WETH position must first be unwrapped and underlyingAddress sent to
     * adapter must be external protocol's ETH representative address.
     *
     * Returns notional amount of underlying tokens and wrapped tokens that were wrapped.
     */
    function _validateWrapAndUpdate(
        string calldata _integrationName,
        ISetToken _setToken,
        address _underlyingToken,
        address _wrappedToken,
        uint256 _underlyingUnits,
        bytes memory _wrapData,
        bool _usesEther
    )
        internal
        returns (uint256, uint256)
    {
        _validateInputs(_setToken, _underlyingToken, _underlyingUnits);

        // Snapshot pre wrap balances
        (
            uint256 preActionUnderlyingNotional,
            uint256 preActionWrapNotional
        ) = _snapshotTargetAssetsBalance(_setToken, _underlyingToken, _wrappedToken);

        uint256 notionalUnderlying = _setToken.totalSupply().getDefaultTotalNotional(_underlyingUnits);
        IWrapV2Adapter wrapAdapter = IWrapV2Adapter(getAndValidateAdapter(_integrationName));

        // Execute any pre-wrap actions depending on if using raw ETH or not
        if (_usesEther) {
            _setToken.invokeUnwrapWETH(address(weth), notionalUnderlying);
        } else {
            _setToken.invokeApprove(_underlyingToken, wrapAdapter.getSpenderAddress(_underlyingToken, _wrappedToken), notionalUnderlying);
        }

        // Get function call data and invoke on SetToken
        _createWrapDataAndInvoke(
            _setToken,
            wrapAdapter,
            _usesEther ? wrapAdapter.ETH_TOKEN_ADDRESS() : _underlyingToken,
            _wrappedToken,
            notionalUnderlying,
            _wrapData
        );

        // Snapshot post wrap balances
        (
            uint256 postActionUnderlyingNotional,
            uint256 postActionWrapNotional
        ) = _snapshotTargetAssetsBalance(_setToken, _underlyingToken, _wrappedToken);

        _updatePosition(_setToken, _underlyingToken, preActionUnderlyingNotional, postActionUnderlyingNotional);
        _updatePosition(_setToken, _wrappedToken, preActionWrapNotional, postActionWrapNotional);

        return (
            preActionUnderlyingNotional.sub(postActionUnderlyingNotional),
            postActionWrapNotional.sub(preActionWrapNotional)
        );
    }

    /**
     * The WrapModule calculates the total notional wrap token to unwrap, then invokes the SetToken to call
     * unwrap by passing its calldata along. When raw ETH is being used (_usesEther = true) underlyingAddress
     * sent to adapter must be set to external protocol's ETH representative address and ETH returned from
     * external protocol is wrapped.
     *
     * Returns notional amount of underlying tokens and wrapped tokens unwrapped.
     */
    function _validateUnwrapAndUpdate(
        string calldata _integrationName,
        ISetToken _setToken,
        address _underlyingToken,
        address _wrappedToken,
        uint256 _wrappedTokenUnits,
        bytes memory _unwrapData,
        bool _usesEther
    )
        internal
        returns (uint256, uint256)
    {
        _validateInputs(_setToken, _wrappedToken, _wrappedTokenUnits);

        (
            uint256 preActionUnderlyingNotional,
            uint256 preActionWrapNotional
        ) = _snapshotTargetAssetsBalance(_setToken, _underlyingToken, _wrappedToken);

        uint256 notionalWrappedToken = _setToken.totalSupply().getDefaultTotalNotional(_wrappedTokenUnits);
        IWrapV2Adapter wrapAdapter = IWrapV2Adapter(getAndValidateAdapter(_integrationName));

        // Approve wrapped token for spending in case protocols require approvals to transfer wrapped tokens
        _setToken.invokeApprove(_wrappedToken, wrapAdapter.getSpenderAddress(_underlyingToken, _wrappedToken), notionalWrappedToken);

        // Get function call data and invoke on SetToken
        _createUnwrapDataAndInvoke(
            _setToken,
            wrapAdapter,
            _usesEther ? wrapAdapter.ETH_TOKEN_ADDRESS() : _underlyingToken,
            _wrappedToken,
            notionalWrappedToken,
            _unwrapData
        );

        if (_usesEther) {
            _setToken.invokeWrapWETH(address(weth), address(_setToken).balance);
        }

        (
            uint256 postActionUnderlyingNotional,
            uint256 postActionWrapNotional
        ) = _snapshotTargetAssetsBalance(_setToken, _underlyingToken, _wrappedToken);

        _updatePosition(_setToken, _underlyingToken, preActionUnderlyingNotional, postActionUnderlyingNotional);
        _updatePosition(_setToken, _wrappedToken, preActionWrapNotional, postActionWrapNotional);

        return (
            postActionUnderlyingNotional.sub(preActionUnderlyingNotional),
            preActionWrapNotional.sub(postActionWrapNotional)
        );
    }

    /**
     * Create the calldata for wrap and then invoke the call on the SetToken.
     */
    function _createWrapDataAndInvoke(
        ISetToken _setToken,
        IWrapV2Adapter _wrapAdapter,
        address _underlyingToken,
        address _wrappedToken,
        uint256 _notionalUnderlying,
        bytes memory _wrapData
    ) internal {
        (
            address callTarget,
            uint256 callValue,
            bytes memory callByteData
        ) = _wrapAdapter.getWrapCallData(
            _underlyingToken,
            _wrappedToken,
            _notionalUnderlying,
            address(_setToken),
            _wrapData
        );

        _setToken.invoke(callTarget, callValue, callByteData);
    }

    /**
     * Create the calldata for unwrap and then invoke the call on the SetToken.
     */
    function _createUnwrapDataAndInvoke(
        ISetToken _setToken,
        IWrapV2Adapter _wrapAdapter,
        address _underlyingToken,
        address _wrappedToken,
        uint256 _notionalUnderlying,
        bytes memory _unwrapData
    ) internal {
        (
            address callTarget,
            uint256 callValue,
            bytes memory callByteData
        ) = _wrapAdapter.getUnwrapCallData(
            _underlyingToken,
            _wrappedToken,
            _notionalUnderlying,
            address(_setToken),
            _unwrapData
        );

        _setToken.invoke(callTarget, callValue, callByteData);
    }

    /**
     * After a wrap/unwrap operation, check the underlying and wrap token quantities and recalculate
     * the units ((total tokens - airdrop)/ total supply). Then update the position on the SetToken.
     */
    function _updatePosition(
        ISetToken _setToken,
        address _token,
        uint256 _preActionTokenBalance,
        uint256 _postActionTokenBalance
    ) internal {
        uint256 newUnit = _setToken.totalSupply().calculateDefaultEditPositionUnit(
            _preActionTokenBalance,
            _postActionTokenBalance,
            _setToken.getDefaultPositionRealUnit(_token).toUint256()
        );

        _setToken.editDefaultPosition(_token, newUnit);
    }

    /**
     * Take snapshot of SetToken's balance of underlying and wrapped tokens.
     */
    function _snapshotTargetAssetsBalance(
        ISetToken _setToken,
        address _underlyingToken,
        address _wrappedToken
    ) internal view returns(uint256, uint256) {
        uint256 underlyingTokenBalance = IERC20(_underlyingToken).balanceOf(address(_setToken));
        uint256 wrapTokenBalance = IERC20(_wrappedToken).balanceOf(address(_setToken));

        return (
            underlyingTokenBalance,
            wrapTokenBalance
        );
    }
}