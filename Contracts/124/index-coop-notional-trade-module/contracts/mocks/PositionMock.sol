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

import { ISetToken } from "../interfaces/ISetToken.sol";
import { Position } from "../protocol/lib/Position.sol";


// Mock contract implementation of Position functions
contract PositionMock {
    constructor()
        public
    {}

    function initialize(ISetToken _setToken) external {
        _setToken.initializeModule();
    }

    function testHasDefaultPosition(ISetToken _setToken, address _component) external view returns(bool) {
        return Position.hasDefaultPosition(_setToken, _component);    
    }

    function testHasExternalPosition(ISetToken _setToken, address _component) external view returns(bool) {
        return Position.hasExternalPosition(_setToken, _component);
    }
    function testHasSufficientDefaultUnits(ISetToken _setToken, address _component, uint256 _unit) external view returns(bool) {
        return Position.hasSufficientDefaultUnits(_setToken, _component, _unit);    
    }
    function testHasSufficientExternalUnits(
        ISetToken _setToken,
        address _component,
        address _module,
        uint256 _unit
    )
        external
        view
        returns(bool)
    {
        return Position.hasSufficientExternalUnits(_setToken, _component, _module, _unit);    
    }

    function testEditDefaultPosition(ISetToken _setToken, address _component, uint256 _newUnit) external {
        return Position.editDefaultPosition(_setToken, _component, _newUnit);   
    }

    function testEditExternalPosition(
        ISetToken _setToken,
        address _component,
        address _module,
        int256 _newUnit,
        bytes memory _data
    )
        external
    {
        Position.editExternalPosition(_setToken, _component, _module, _newUnit, _data);
    }

    function testGetDefaultTotalNotional(
        uint256 _setTokenSupply,
        uint256 _positionUnit
    )
        external
        pure
        returns (uint256)
    {
        return Position.getDefaultTotalNotional(_setTokenSupply, _positionUnit);
    }

    function testGetDefaultPositionUnit(
        uint256 _setTokenSupply,
        uint256 _totalNotional
    )
        external
        pure
        returns (uint256)
    {
        return Position.getDefaultPositionUnit(_setTokenSupply, _totalNotional);
    }

    function testGetDefaultTrackedBalance(ISetToken _setToken, address _component)
        external
        view
        returns (uint256)
    {
        return Position.getDefaultTrackedBalance(_setToken, _component);
    }

    function testCalculateAndEditDefaultPosition(
        ISetToken _setToken,
        address _component,
        uint256 _setTotalSupply,
        uint256 _componentPreviousBalance
    )
        external
        returns (uint256, uint256, uint256)
    {
        return Position.calculateAndEditDefaultPosition(
            _setToken,
            _component,
            _setTotalSupply,
            _componentPreviousBalance
        );
    }

    function testCalculateDefaultEditPositionUnit(
        uint256 _setTokenSupply,
        uint256 _preTotalNotional,
        uint256 _postTotalNotional,
        uint256 _prePositionUnit
    )
        external
        pure
        returns (uint256)
    {
        return Position.calculateDefaultEditPositionUnit(
            _setTokenSupply,
            _preTotalNotional,
            _postTotalNotional,
            _prePositionUnit
        );
    }
}