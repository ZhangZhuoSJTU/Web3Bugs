// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

import {EnumerableSet} from "@openzeppelin/contracts/utils/EnumerableSet.sol";

interface IInstanceRegistry {
    /* events */

    event InstanceAdded(address instance);
    event InstanceRemoved(address instance);

    /* view functions */

    function isInstance(address instance) external view returns (bool validity);

    function instanceCount() external view returns (uint256 count);

    function instanceAt(uint256 index) external view returns (address instance);
}

/// @title InstanceRegistry
contract InstanceRegistry is IInstanceRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    /* storage */

    EnumerableSet.AddressSet private _instanceSet;

    /* view functions */

    function isInstance(address instance) external view override returns (bool validity) {
        return _instanceSet.contains(instance);
    }

    function instanceCount() external view override returns (uint256 count) {
        return _instanceSet.length();
    }

    function instanceAt(uint256 index) external view override returns (address instance) {
        return _instanceSet.at(index);
    }

    /* admin functions */

    function _register(address instance) internal {
        require(_instanceSet.add(instance), "InstanceRegistry: already registered");
        emit InstanceAdded(instance);
    }
}
