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
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { SignedSafeMath } from "@openzeppelin/contracts/math/SignedSafeMath.sol";

import { AddressArrayUtils } from "../../../lib/AddressArrayUtils.sol";
import { IController } from "../../../interfaces/IController.sol";
import { IModuleIssuanceHook } from "../../../interfaces/IModuleIssuanceHook.sol";
import { Invoke } from "../../lib/Invoke.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { IStakingAdapter } from "../../../interfaces/IStakingAdapter.sol";
import { ModuleBase } from "../../lib/ModuleBase.sol";
import { Position } from "../../lib/Position.sol";


/**
 * @title StakingModule
 * @author Set Protocol
 *
 * Module that enables managers to stake tokens in external protocols in order to take advantage of token distributions.
 * Managers are in charge of opening and closing staking positions. When issuing new SetTokens the IssuanceModule can call
 * the StakingModule in order to facilitate replicating existing staking positions.
 *
 * The StakingModule works in conjunction with StakingAdapters, in which the claimAdapterID / integrationNames are stored
 * on the integration registry. StakingAdapters for the StakingModule are more functional in nature as the same staking
 * contracts are being used across multiple protocols.
 *
 * An example of staking actions include staking yCRV tokens in CRV Liquidity Gauge
 */
contract StakingModule is ModuleBase, IModuleIssuanceHook {
    using AddressArrayUtils for address[];
    using Invoke for ISetToken;
    using Position for ISetToken;
    using SafeCast for int256;
    using SignedSafeMath for int256;
    using SafeCast for uint256;
    using SafeMath for uint256;
    using Position for uint256;

    /* ============ Events ============ */

    event ComponentStaked(
        ISetToken indexed _setToken,
        IERC20 indexed _component,
        address indexed _stakingContract,
        uint256 _componentPositionUnits,
        IStakingAdapter _adapter
    );

    event ComponentUnstaked(
        ISetToken indexed _setToken,
        IERC20 indexed _component,
        address indexed _stakingContract,
        uint256 _componentPositionUnits,
        IStakingAdapter _adapter
    );

    /* ============ Structs ============ */

    struct StakingPosition {
        bytes32 adapterHash;                // Hash of adapter name
        uint256 componentPositionUnits;     // The amount of tokens, per Set, being staked on associated staking contract
    }

    struct ComponentPositions {
        address[] stakingContracts;                         // List of staking contracts component is being staked on
        mapping(address => StakingPosition) positions;      // Details of each stakingContract's position
    }

    /* ============ State Variables ============ */
    // Mapping relating SetToken to a component to a struct holding all the external staking positions for the component
    mapping(ISetToken => mapping(IERC20 => ComponentPositions)) internal stakingPositions;

    /* ============ Constructor ============ */

    constructor(IController _controller) public ModuleBase(_controller) {}

    /* ============ External Functions ============ */

    /**
     * MANAGER ONLY: Stake _component in external staking contract. Update state on StakingModule and SetToken to reflect
     * new position. Manager states the contract they are wishing to stake the passed component in as well as how many
     * position units they wish to stake. Manager must also identify the adapter they wish to use.
     *
     * @param _setToken                 Address of SetToken contract
     * @param _stakeContract            Address of staking contract
     * @param _component                Address of token being staked
     * @param _adapterName              Name of adapter used to interact with staking contract
     * @param _componentPositionUnits   Quantity of token to stake in position units
     */
    function stake(
        ISetToken _setToken,
        address _stakeContract,
        IERC20 _component,
        string memory _adapterName,
        uint256 _componentPositionUnits
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        require(_setToken.hasSufficientDefaultUnits(address(_component), _componentPositionUnits), "Not enough component to stake");

        IStakingAdapter adapter = IStakingAdapter(getAndValidateAdapter(_adapterName));

        _stake(_setToken, _stakeContract, _component, adapter, _componentPositionUnits, _setToken.totalSupply());

        _updateStakeState(_setToken, _stakeContract, _component, _adapterName, _componentPositionUnits);

        emit ComponentStaked(
            _setToken,
            _component,
            _stakeContract,
            _componentPositionUnits,
            adapter
        );
    }

    /**
     * MANAGER ONLY: Unstake _component from external staking contract. Update state on StakingModule and SetToken to reflect
     * new position.
     *
     * @param _setToken                 Address of SetToken contract
     * @param _stakeContract            Address of staking contract
     * @param _component                Address of token being staked
     * @param _adapterName              Name of adapter used to interact with staking contract
     * @param _componentPositionUnits   Quantity of token to unstake in position units
     */
    function unstake(
        ISetToken _setToken,
        address _stakeContract,
        IERC20 _component,
        string memory _adapterName,
        uint256 _componentPositionUnits
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        require(
            getStakingPositionUnit(_setToken, _component, _stakeContract) >= _componentPositionUnits,
            "Not enough component tokens staked"
        );

        IStakingAdapter adapter = IStakingAdapter(getAndValidateAdapter(_adapterName));

        _unstake(_setToken, _stakeContract, _component, adapter, _componentPositionUnits, _setToken.totalSupply());

        _updateUnstakeState(_setToken, _stakeContract, _component, _componentPositionUnits);

        emit ComponentUnstaked(
            _setToken,
            _component,
            _stakeContract,
            _componentPositionUnits,
            adapter
        );
    }

    /**
     * MODULE ONLY: On issuance, replicates all staking positions for a given component by staking the component transferred into
     * the SetToken by an issuer. The amount staked should only be the notional amount required to replicate a _setTokenQuantity
     * amount of a position. No updates to positions should take place.
     *
     * @param _setToken                 Address of SetToken contract
     * @param _component                Address of token being staked
     * @param _setTokenQuantity         Quantity of SetToken being issued
     */
    function componentIssueHook(ISetToken _setToken, uint256 _setTokenQuantity, IERC20 _component, bool /* _isEquity */) external override onlyModule(_setToken) {
        address[] memory stakingContracts = getStakingContracts(_setToken, _component);
        for (uint256 i = 0; i < stakingContracts.length; i++) {
            // NOTE: We assume here that the calling module has transferred component tokens to the SetToken from the issuer
            StakingPosition memory stakingPosition = getStakingPosition(_setToken, _component, stakingContracts[i]);

            _stake(
                _setToken,
                stakingContracts[i],
                _component,
                IStakingAdapter(getAndValidateAdapterWithHash(stakingPosition.adapterHash)),
                stakingPosition.componentPositionUnits,
                _setTokenQuantity
            );
        }
    }

    /**
     * MODULE ONLY: On redemption, unwind all staking positions for a given asset by unstaking the given component. The amount
     * unstaked should only be the notional amount required to unwind a _setTokenQuantity amount of a position. No updates to
     * positions should take place.
     *
     * @param _setToken                 Address of SetToken contract
     * @param _component                Address of token being staked
     * @param _setTokenQuantity         Quantity of SetToken being issued
     */
    function componentRedeemHook(ISetToken _setToken, uint256 _setTokenQuantity, IERC20 _component, bool /* _isEquity */) external override onlyModule(_setToken) {
        address[] memory stakingContracts = getStakingContracts(_setToken, _component);
        for (uint256 i = 0; i < stakingContracts.length; i++) {
            StakingPosition memory stakingPosition = getStakingPosition(_setToken, _component, stakingContracts[i]);

            _unstake(
                _setToken,
                stakingContracts[i],
                _component,
                IStakingAdapter(getAndValidateAdapterWithHash(stakingPosition.adapterHash)),
                stakingPosition.componentPositionUnits,
                _setTokenQuantity
            );
        }
    }

    function moduleIssueHook(ISetToken _setToken, uint256 _setTokenQuantity) external override {}
    function moduleRedeemHook(ISetToken _setToken, uint256 _setTokenQuantity) external override {}

    /**
     * Initializes this module to the SetToken. Only callable by the SetToken's manager.
     *
     * @param _setToken             Instance of the SetToken to issue
     */
    function initialize(
        ISetToken _setToken
    )
        external
        onlySetManager(_setToken, msg.sender)
        onlyValidAndPendingSet(_setToken)
    {
        _setToken.initializeModule();
    }

    /**
     * Removes this module from the SetToken, via call by the SetToken. If an outstanding staking position remains using
     * this module then it cannot be removed. Outstanding staking must be closed out first before removal.
     */
    function removeModule() external override {
        ISetToken setToken = ISetToken(msg.sender);
        address[] memory components = setToken.getComponents();
        for (uint256 i = 0; i < components.length; i++) {
            require(
                stakingPositions[setToken][IERC20(components[i])].stakingContracts.length == 0,
                "Open positions must be closed"
            );
        }
    }


    /* ============ External Getter Functions ============ */

    function hasStakingPosition(ISetToken _setToken, IERC20 _component, address _stakeContract) public view returns(bool) {
        return getStakingContracts(_setToken, _component).contains(_stakeContract);
    }

    function getStakingContracts(ISetToken _setToken, IERC20 _component) public view returns(address[] memory) {
        return stakingPositions[_setToken][_component].stakingContracts;
    }

    function getStakingPosition(ISetToken _setToken, IERC20 _component, address _stakeContract)
        public
        view
        returns(StakingPosition memory)
    {
        return stakingPositions[_setToken][_component].positions[_stakeContract];
    }

    function getStakingPositionUnit(ISetToken _setToken, IERC20 _component, address _stakeContract)
        public
        view
        returns(uint256)
    {
        return getStakingPosition(_setToken, _component, _stakeContract).componentPositionUnits;
    }

    /* ============ Internal Functions ============ */

    /**
     * Stake _component in external staking contract.
     *
     * @param _setToken                 Address of SetToken contract
     * @param _stakeContract            Address of staking contract
     * @param _component                Address of token being staked
     * @param _adapter                  Address of adapter used to interact with staking contract
     * @param _componentPositionUnits   Quantity of token to stake in position units
     * @param _setTokenStakeQuantity    Quantity of SetTokens to stake
     */
    function _stake(
        ISetToken _setToken,
        address _stakeContract,
        IERC20 _component,
        IStakingAdapter _adapter,
        uint256 _componentPositionUnits,
        uint256 _setTokenStakeQuantity
    )
        internal
    {
        uint256 notionalStakeQuantity = _setTokenStakeQuantity.getDefaultTotalNotional(_componentPositionUnits);

        address spender = _adapter.getSpenderAddress(_stakeContract);

        _setToken.invokeApprove(address(_component), spender, notionalStakeQuantity);

        (
            address target, uint256 callValue, bytes memory methodData
        ) = _adapter.getStakeCallData(_stakeContract, notionalStakeQuantity);

        _setToken.invoke(target, callValue, methodData);
    }

    /**
     * Unstake position from external staking contract and validates expected components were received.
     *
     * @param _setToken                 Address of SetToken contract
     * @param _stakeContract            Address of staking contract
     * @param _component                Address of token being unstaked
     * @param _adapter                  Address of adapter used to interact with staking contract
     * @param _componentPositionUnits   Quantity of token to unstake in position units
     */
    function _unstake(
        ISetToken _setToken,
        address _stakeContract,
        IERC20 _component,
        IStakingAdapter _adapter,
        uint256 _componentPositionUnits,
        uint256 _setTokenUnstakeQuantity
    )
        internal
    {
        uint256 preActionBalance = _component.balanceOf(address(_setToken));

        uint256 notionalUnstakeQuantity = _setTokenUnstakeQuantity.getDefaultTotalNotional(_componentPositionUnits);
        (
            address target, uint256 callValue, bytes memory methodData
        ) = _adapter.getUnstakeCallData(_stakeContract, notionalUnstakeQuantity);

        _setToken.invoke(target, callValue, methodData);

        uint256 postActionBalance = _component.balanceOf(address(_setToken));
        require(preActionBalance.add(notionalUnstakeQuantity) <= postActionBalance, "Not enough tokens returned from stake contract");
    }

    /**
     * Update positions on SetToken and tracking on StakingModule after staking is complete. Includes the following updates:
     *  - If adding to position then add positionUnits to existing position amount on StakingModule
     *  - If opening new staking position add stakeContract to stakingContracts list and create position entry in position mapping
     *    (on StakingModule)
     *  - Subtract from Default position of _component on SetToken
     *  - Add to external position of _component on SetToken referencing this module
     *
     * @param _setToken                 Address of SetToken contract
     * @param _stakeContract            Address of staking contract
     * @param _component                Address of token being unstaked
     * @param _adapterName              Address of adapter used to interact with staking contract
     * @param _componentPositionUnits   Quantity of token to stake in position units
     */
    function _updateStakeState(
        ISetToken _setToken,
        address _stakeContract,
        IERC20 _component,
        string memory _adapterName,
        uint256 _componentPositionUnits
    )
        internal
    {
        if (hasStakingPosition(_setToken, _component, _stakeContract)) {
            stakingPositions[_setToken][_component].positions[_stakeContract].componentPositionUnits = _componentPositionUnits.add(
                getStakingPositionUnit(_setToken, _component, _stakeContract)
            );
        } else {
            stakingPositions[_setToken][_component].stakingContracts.push(_stakeContract);
            stakingPositions[_setToken][_component].positions[_stakeContract] = StakingPosition({
                componentPositionUnits: _componentPositionUnits,
                adapterHash: getNameHash(_adapterName)
            });
        }

        uint256 newDefaultTokenUnit = _setToken.getDefaultPositionRealUnit(address(_component)).toUint256().sub(_componentPositionUnits);
        _setToken.editDefaultPosition(address(_component), newDefaultTokenUnit);

        int256 newExternalTokenUnit = _setToken.getExternalPositionRealUnit(address(_component), address(this))
            .add(_componentPositionUnits.toInt256());
        _setToken.editExternalPosition(address(_component), address(this), newExternalTokenUnit, "");
    }

    /**
     * Update positions on SetToken and tracking on StakingModule after unstaking is complete. Includes the following updates:
     *  - If paring down position then subtract positionUnits from existing position amount on StakingModule
     *  - If closing staking position remove _stakeContract from stakingContracts list and delete position entry in position mapping
     *    (on StakingModule)
     *  - Add to Default position of _component on SetToken
     *  - Subtract from external position of _component on SetToken referencing this module
     *
     * @param _setToken                 Address of SetToken contract
     * @param _stakeContract            Address of staking contract
     * @param _component                Address of token being unstaked
     * @param _componentPositionUnits   Quantity of token to stake in position units
     */
    function _updateUnstakeState(
        ISetToken _setToken,
        address _stakeContract,
        IERC20 _component,
        uint256 _componentPositionUnits
    )
        internal
    {
        uint256 remainingPositionUnits = getStakingPositionUnit(_setToken, _component, _stakeContract).sub(_componentPositionUnits);

        if (remainingPositionUnits > 0) {
            stakingPositions[_setToken][_component].positions[_stakeContract].componentPositionUnits = remainingPositionUnits;
        } else {
            stakingPositions[_setToken][_component].stakingContracts = getStakingContracts(_setToken, _component).remove(_stakeContract);
            delete stakingPositions[_setToken][_component].positions[_stakeContract];
        }

        uint256 newTokenUnit = _setToken.getDefaultPositionRealUnit(address(_component)).toUint256().add(_componentPositionUnits);

        _setToken.editDefaultPosition(address(_component), newTokenUnit);

        int256 newExternalTokenUnit = _setToken.getExternalPositionRealUnit(address(_component), address(this))
            .sub(_componentPositionUnits.toInt256());

        _setToken.editExternalPosition(address(_component), address(this), newExternalTokenUnit, "");
    }
}