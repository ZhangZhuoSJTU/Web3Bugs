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

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { AddressArrayUtils } from "../lib/AddressArrayUtils.sol";
import { INAVIssuanceHook } from "../interfaces/INAVIssuanceHook.sol";
import { ISetToken } from "../interfaces/ISetToken.sol";

/**
 * @title AssetLimitHook
 * @author Set Protocol
 *
 * NAVIssuanceModule hook that checks the issue and redeem amounts are lower than a given limit.
 */
contract AssetLimitHook is INAVIssuanceHook, Ownable {
    using AddressArrayUtils for address[];

    /* ============ State Variables ============ */

    mapping(address => uint256) public assetLimits;
    address[] public assets;

    /* ============ Constructor ============ */

    constructor(address[] memory _assets, uint256[] memory _limits) public {
        require(_assets.length == _limits.length, "Arrays must be equal");
        require(_assets.length != 0, "Array must not be empty");
        
        for (uint256 i = 0; i < _assets.length; i++) {
            address asset = _assets[i];
            require(assetLimits[asset] == 0, "Asset already added");
            assetLimits[asset] = _limits[i];
        }

        assets = _assets;
    }

    /* ============ External Functions ============ */

    function invokePreIssueHook(
        ISetToken /*_setToken*/,
        address _reserveAsset,
        uint256 _reserveAssetQuantity,
        address /*_sender*/,
        address /*_to*/
    )
        external
        override
    {
        require(
            _reserveAssetQuantity <= assetLimits[_reserveAsset],
            "Issue size exceeds asset limit"
        );
    }

    function invokePreRedeemHook(
        ISetToken _setToken,
        uint256 _redeemQuantity,
        address /*_sender*/,
        address /*_to*/
    )
        external
        override
    {
        require(
            _redeemQuantity <= assetLimits[address(_setToken)],
            "Redeem size exceeds asset limit"
        );
    }

    function addAssetLimit(address _asset, uint256 _newLimit) external onlyOwner {
        require(assetLimits[_asset] == 0, "Asset already added");
        assetLimits[_asset] = _newLimit;
        assets.push(_asset);
    }

    function editAssetLimit(address _asset, uint256 _newLimit) external onlyOwner {
        require(assetLimits[_asset] != 0, "Asset not added");
        assetLimits[_asset] = _newLimit;
    }

    function removeAssetLimit(address _asset) external onlyOwner {
        require(assetLimits[_asset] != 0, "Asset not added");
        delete assetLimits[_asset];
        assets = assets.remove(_asset);
    }

    /* ============ Getters ============ */
    
    function getAssets() external view returns(address[] memory) { return assets; }
}