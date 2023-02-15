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

import { AddressArrayUtils } from "../../../lib/AddressArrayUtils.sol";
import { IClaimAdapter } from "../../../interfaces/IClaimAdapter.sol";
import { IController } from "../../../interfaces/IController.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { ModuleBase } from "../../lib/ModuleBase.sol";


/**
 * @title ClaimModule
 * @author Set Protocol
 *
 * Module that enables managers to claim tokens from external protocols given to the Set as part of participating in
 * incentivized activities of other protocols. The ClaimModule works in conjunction with ClaimAdapters, in which the
 * claimAdapterID / integrationNames are stored on the integration registry.
 *
 * Design:
 * The ecosystem is coalescing around a few standards of how reward programs are created, using forks of popular
 * contracts such as Synthetix's Mintr. Thus, the Claim architecture reflects a more functional vs external-protocol
 * approach where an adapter with common functionality can be used across protocols.
 *
 * Definitions:
 * Reward Pool: A reward pool is a contract associated with an external protocol's reward. Examples of reward pools
 *   include the Curve sUSDV2 Gauge or the Synthetix iBTC StakingReward contract.
 * Adapter: An adapter contains the logic and context for how a reward pool should be claimed - returning the requisite
 *   function signature. Examples of adapters include StakingRewardAdapter (for getting rewards from Synthetix-like
 *   reward contracts) and CurveClaimAdapter (for calling Curve Minter contract's mint function)
 * ClaimSettings: A reward pool can be associated with multiple awards. For example, a Curve liquidity gauge can be
 *   associated with the CURVE_CLAIM adapter to claim CRV and CURVE_DIRECT adapter to claim BPT.
 */
contract ClaimModule is ModuleBase {
    using AddressArrayUtils for address[];

    /* ============ Events ============ */

    event RewardClaimed(
        ISetToken indexed _setToken,
        address indexed _rewardPool,
        IClaimAdapter indexed _adapter,
        uint256 _amount
    );

    event AnyoneClaimUpdated(
        ISetToken indexed _setToken,
        bool _anyoneClaim
    );

    /* ============ Modifiers ============ */

    /**
     * Throws if claim is confined to the manager and caller is not the manager
     */
    modifier onlyValidCaller(ISetToken _setToken) {
        require(_isValidCaller(_setToken), "Must be valid caller");
        _;
    }

    /* ============ State Variables ============ */

    // Indicates if any address can call claim or just the manager of the SetToken
    mapping(ISetToken => bool) public anyoneClaim;

    // Map and array of rewardPool addresses to claim rewards for the SetToken
    mapping(ISetToken => address[]) public rewardPoolList;
    // Map from set tokens to rewards pool address to isAdded boolean. Used to check if a reward pool has been added in O(1) time
    mapping(ISetToken => mapping(address => bool)) public rewardPoolStatus;

    // Map and array of adapters associated to the rewardPool for the SetToken
    mapping(ISetToken => mapping(address => address[])) public claimSettings;
    // Map from set tokens to rewards pool address to claim adapters to isAdded boolean. Used to check if an adapter has been added in O(1) time
    mapping(ISetToken => mapping(address => mapping(address => bool))) public claimSettingsStatus;


    /* ============ Constructor ============ */

    constructor(IController _controller) public ModuleBase(_controller) {}

    /* ============ External Functions ============ */

    /**
     * Claim the rewards available on the rewardPool for the specified claim integration.
     * Callable only by manager unless manager has set anyoneClaim to true.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardPool           Address of the rewardPool that identifies the contract governing claims
     * @param _integrationName      ID of claim module integration (mapping on integration registry)
     */
    function claim(
        ISetToken _setToken,
        address _rewardPool,
        string calldata _integrationName
    )
        external
        onlyValidAndInitializedSet(_setToken)
        onlyValidCaller(_setToken)
    {
        _claim(_setToken, _rewardPool, _integrationName);
    }

    /**
     * Claims rewards on all the passed rewardPool/claim integration pairs. Callable only by manager unless manager has
     * set anyoneClaim to true.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardPools          Addresses of rewardPools that identifies the contract governing claims. Maps to same
     *                                  index integrationNames
     * @param _integrationNames     Human-readable names matching adapter used to collect claim on pool. Maps to same index
     *                                  in rewardPools
     */
    function batchClaim(
        ISetToken _setToken,
        address[] calldata _rewardPools,
        string[] calldata _integrationNames
    )
        external
        onlyValidAndInitializedSet(_setToken)
        onlyValidCaller(_setToken)
    {
        uint256 poolArrayLength = _validateBatchArrays(_rewardPools, _integrationNames);
        for (uint256 i = 0; i < poolArrayLength; i++) {
            _claim(_setToken, _rewardPools[i], _integrationNames[i]);
        }
    }

    /**
     * SET MANAGER ONLY. Update whether manager allows other addresses to call claim.
     *
     * @param _setToken             Address of SetToken
     */
    function updateAnyoneClaim(ISetToken _setToken, bool _anyoneClaim) external onlyManagerAndValidSet(_setToken) {
        anyoneClaim[_setToken] = _anyoneClaim;
        emit AnyoneClaimUpdated(_setToken, _anyoneClaim);
    }
    /**
     * SET MANAGER ONLY. Adds a new claim integration for an existent rewardPool. If rewardPool doesn't have existing
     * claims then rewardPool is added to rewardPoolLiost. The claim integration is associated to an adapter that
     * provides the functionality to claim the rewards for a specific token.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardPool           Address of the rewardPool that identifies the contract governing claims
     * @param _integrationName      ID of claim module integration (mapping on integration registry)
     */
    function addClaim(
        ISetToken _setToken,
        address _rewardPool,
        string calldata _integrationName
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        _addClaim(_setToken, _rewardPool, _integrationName);
    }

    /**
     * SET MANAGER ONLY. Adds a new rewardPool to the list to perform claims for the SetToken indicating the list of
     * claim integrations. Each claim integration is associated to an adapter that provides the functionality to claim
     * the rewards for a specific token.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardPools          Addresses of rewardPools that identifies the contract governing claims. Maps to same
     *                                  index integrationNames
     * @param _integrationNames     Human-readable names matching adapter used to collect claim on pool. Maps to same index
     *                                  in rewardPools
     */
    function batchAddClaim(
        ISetToken _setToken,
        address[] calldata _rewardPools,
        string[] calldata _integrationNames
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        _batchAddClaim(_setToken, _rewardPools, _integrationNames);
    }

    /**
     * SET MANAGER ONLY. Removes a claim integration from an existent rewardPool. If no claim remains for reward pool then
     * reward pool is removed from rewardPoolList.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardPool           Address of the rewardPool that identifies the contract governing claims
     * @param _integrationName      ID of claim module integration (mapping on integration registry)
     */
    function removeClaim(
        ISetToken _setToken,
        address _rewardPool,
        string calldata _integrationName
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        _removeClaim(_setToken, _rewardPool, _integrationName);
    }

    /**
     * SET MANAGER ONLY. Batch removes claims from SetToken's settings.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardPools          Addresses of rewardPools that identifies the contract governing claims. Maps to same index
     *                                  integrationNames
     * @param _integrationNames     Human-readable names matching adapter used to collect claim on pool. Maps to same index in
     *                                  rewardPools
     */
    function batchRemoveClaim(
        ISetToken _setToken,
        address[] calldata _rewardPools,
        string[] calldata _integrationNames
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        uint256 poolArrayLength = _validateBatchArrays(_rewardPools, _integrationNames);
        for (uint256 i = 0; i < poolArrayLength; i++) {
            _removeClaim(_setToken, _rewardPools[i], _integrationNames[i]);
        }
    }

    /**
     * SET MANAGER ONLY. Initializes this module to the SetToken.
     *
     * @param _setToken             Instance of the SetToken to issue
     * @param _anyoneClaim          Boolean indicating if anyone can claim or just manager
     * @param _rewardPools          Addresses of rewardPools that identifies the contract governing claims. Maps to same index
     *                                  integrationNames
     * @param _integrationNames     Human-readable names matching adapter used to collect claim on pool. Maps to same index in
     *                                  rewardPools
     */
    function initialize(
        ISetToken _setToken,
        bool _anyoneClaim,
        address[] calldata _rewardPools,
        string[] calldata _integrationNames
    )
        external
        onlySetManager(_setToken, msg.sender)
        onlyValidAndPendingSet(_setToken)
    {
        _batchAddClaim(_setToken, _rewardPools, _integrationNames);
        anyoneClaim[_setToken] = _anyoneClaim;
        _setToken.initializeModule();
    }

    /**
     * Removes this module from the SetToken, via call by the SetToken.
     */
    function removeModule() external override {
        delete anyoneClaim[ISetToken(msg.sender)];

        // explicitly delete all elements for gas refund
        address[] memory setTokenPoolList = rewardPoolList[ISetToken(msg.sender)];
        for (uint256 i = 0; i < setTokenPoolList.length; i++) {

            address[] storage adapterList = claimSettings[ISetToken(msg.sender)][setTokenPoolList[i]];
            for (uint256 j = 0; j < adapterList.length; j++) {

                address toRemove = adapterList[j];
                claimSettingsStatus[ISetToken(msg.sender)][setTokenPoolList[i]][toRemove] = false;

                delete adapterList[j];
            }
            delete claimSettings[ISetToken(msg.sender)][setTokenPoolList[i]];
        }

        for (uint256 i = 0; i < rewardPoolList[ISetToken(msg.sender)].length; i++) {
            address toRemove = rewardPoolList[ISetToken(msg.sender)][i];
            rewardPoolStatus[ISetToken(msg.sender)][toRemove] = false;

            delete rewardPoolList[ISetToken(msg.sender)][i];
        }
        delete rewardPoolList[ISetToken(msg.sender)];
    }

    /**
     * Get list of rewardPools to perform claims for the SetToken.
     *
     * @param _setToken             Address of SetToken
     * @return                      Array of rewardPool addresses to claim rewards for the SetToken
     */
    function getRewardPools(ISetToken _setToken) external view returns (address[] memory) {
        return rewardPoolList[_setToken];
    }

    /**
     * Get boolean indicating if the rewardPool is in the list to perform claims for the SetToken.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardPool           Address of rewardPool
     * @return                      Boolean indicating if the rewardPool is in the list for claims.
     */
    function isRewardPool(ISetToken _setToken, address _rewardPool) public view returns (bool) {
        return rewardPoolStatus[_setToken][_rewardPool];
    }

    /**
     * Get list of claim integration of the rewardPool for the SetToken.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardPool           Address of rewardPool
     * @return                      Array of adapter addresses associated to the rewardPool for the SetToken
     */
    function getRewardPoolClaims(ISetToken _setToken, address _rewardPool) external view returns (address[] memory) {
        return claimSettings[_setToken][_rewardPool];
    }

    /**
     * Get boolean indicating if the adapter address of the claim integration is associated to the rewardPool.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardPool           Address of rewardPool
     * @param _integrationName      ID of claim module integration (mapping on integration registry)
     * @return                      Boolean indicating if the claim integration is associated to the rewardPool.
     */
    function isRewardPoolClaim(
        ISetToken _setToken,
        address _rewardPool,
        string calldata _integrationName
    )
        external
        view
        returns (bool)
    {
        address adapter = getAndValidateAdapter(_integrationName);
        return claimSettingsStatus[_setToken][_rewardPool][adapter];
    }

    /**
     * Get the rewards available to be claimed by the claim integration on the rewardPool.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardPool           Address of the rewardPool that identifies the contract governing claims
     * @param _integrationName      ID of claim module integration (mapping on integration registry)
     * @return rewards              Amount of units available to be claimed
     */
    function getRewards(
        ISetToken _setToken,
        address _rewardPool,
        string calldata _integrationName
    )
        external
        view
        returns (uint256)
    {
        IClaimAdapter adapter = _getAndValidateIntegrationAdapter(_setToken, _rewardPool, _integrationName);
        return adapter.getRewardsAmount(_setToken, _rewardPool);
    }

    /* ============ Internal Functions ============ */

    /**
     * Claim the rewards, if available, on the rewardPool using the specified adapter. Interact with the adapter to get
     * the rewards available, the calldata for the SetToken to invoke the claim and the token associated to the claim.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardPool           Address of the rewardPool that identifies the contract governing claims
     * @param _integrationName      Human readable name of claim integration
     */
    function _claim(ISetToken _setToken, address _rewardPool, string calldata _integrationName) internal {
        require(isRewardPool(_setToken, _rewardPool), "RewardPool not present");
        IClaimAdapter adapter = _getAndValidateIntegrationAdapter(_setToken, _rewardPool, _integrationName);

        IERC20 rewardsToken = IERC20(adapter.getTokenAddress(_rewardPool));
        uint256 initRewardsBalance = rewardsToken.balanceOf(address(_setToken));

        (
            address callTarget,
            uint256 callValue,
            bytes memory callByteData
        ) = adapter.getClaimCallData(
            _setToken,
            _rewardPool
        );

        _setToken.invoke(callTarget, callValue, callByteData);

        uint256 finalRewardsBalance = rewardsToken.balanceOf(address(_setToken));

        emit RewardClaimed(_setToken, _rewardPool, adapter, finalRewardsBalance.sub(initRewardsBalance));
    }

    /**
     * Gets the adapter and validate it is associated to the list of claim integration of a rewardPool.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardsPool          Sddress of rewards pool
     * @param _integrationName      ID of claim module integration (mapping on integration registry)
     */
    function _getAndValidateIntegrationAdapter(
        ISetToken _setToken,
        address _rewardsPool,
        string calldata _integrationName
    )
        internal
        view
        returns (IClaimAdapter)
    {
        address adapter = getAndValidateAdapter(_integrationName);
        require(claimSettingsStatus[_setToken][_rewardsPool][adapter], "Adapter integration not present");
        return IClaimAdapter(adapter);
    }

    /**
     * Validates and store the adapter address used to claim rewards for the passed rewardPool. If after adding
     * adapter to pool length of adapters is 1 then add to rewardPoolList as well.
     *
     * @param _setToken                 Address of SetToken
     * @param _rewardPool               Address of the rewardPool that identifies the contract governing claims
     * @param _integrationName          ID of claim module integration (mapping on integration registry)
     */
    function _addClaim(ISetToken _setToken, address _rewardPool, string calldata _integrationName) internal {
        address adapter = getAndValidateAdapter(_integrationName);
        address[] storage _rewardPoolClaimSettings = claimSettings[_setToken][_rewardPool];

        require(!claimSettingsStatus[_setToken][_rewardPool][adapter], "Integration names must be unique");
        _rewardPoolClaimSettings.push(adapter);
        claimSettingsStatus[_setToken][_rewardPool][adapter] = true;

        if (!rewardPoolStatus[_setToken][_rewardPool]) {
            rewardPoolList[_setToken].push(_rewardPool);
            rewardPoolStatus[_setToken][_rewardPool] = true;
        }
    }

    /**
     * Internal version. Adds a new rewardPool to the list to perform claims for the SetToken indicating the list of claim
     * integrations. Each claim integration is associated to an adapter that provides the functionality to claim the rewards
     * for a specific token.
     *
     * @param _setToken             Address of SetToken
     * @param _rewardPools          Addresses of rewardPools that identifies the contract governing claims. Maps to same
     *                                  index integrationNames
     * @param _integrationNames     Human-readable names matching adapter used to collect claim on pool. Maps to same index
     *                                  in rewardPools
     */
    function _batchAddClaim(
        ISetToken _setToken,
        address[] calldata _rewardPools,
        string[] calldata _integrationNames
    )
        internal
    {
        uint256 poolArrayLength = _validateBatchArrays(_rewardPools, _integrationNames);
        for (uint256 i = 0; i < poolArrayLength; i++) {
            _addClaim(_setToken, _rewardPools[i], _integrationNames[i]);
        }
    }

    /**
     * Validates and stores the adapter address used to claim rewards for the passed rewardPool. If no adapters
     * left after removal then remove rewardPool from rewardPoolList and delete entry in claimSettings.
     *
     * @param _setToken                 Address of SetToken
     * @param _rewardPool               Address of the rewardPool that identifies the contract governing claims
     * @param _integrationName          ID of claim module integration (mapping on integration registry)
     */
    function _removeClaim(ISetToken _setToken, address _rewardPool, string calldata _integrationName) internal {
        address adapter = getAndValidateAdapter(_integrationName);

        require(claimSettingsStatus[_setToken][_rewardPool][adapter], "Integration must be added");
        claimSettings[_setToken][_rewardPool].removeStorage(adapter);
        claimSettingsStatus[_setToken][_rewardPool][adapter] = false;

        if (claimSettings[_setToken][_rewardPool].length == 0) {
            rewardPoolList[_setToken].removeStorage(_rewardPool);
            rewardPoolStatus[_setToken][_rewardPool] = false;
        }
    }

    /**
     * For batch functions validate arrays are of equal length and not empty. Return length of array for iteration.
     *
     * @param _rewardPools              Addresses of the rewardPool that identifies the contract governing claims
     * @param _integrationNames         IDs of claim module integration (mapping on integration registry)
     * @return                          Length of arrays
     */
    function _validateBatchArrays(
        address[] memory _rewardPools,
        string[] calldata _integrationNames
    )
        internal
        pure
        returns(uint256)
    {
        uint256 poolArrayLength = _rewardPools.length;
        require(poolArrayLength == _integrationNames.length, "Array length mismatch");
        require(poolArrayLength > 0, "Arrays must not be empty");
        return poolArrayLength;
    }

    /**
     * If claim is confined to the manager, manager must be caller
     *
     * @param _setToken             Address of SetToken
     * @return bool                 Whether or not the caller is valid
     */
    function _isValidCaller(ISetToken _setToken) internal view returns(bool) {
        return anyoneClaim[_setToken] || isSetManager(_setToken, msg.sender);
    }
}