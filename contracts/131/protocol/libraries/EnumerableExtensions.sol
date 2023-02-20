// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../libraries/EnumerableMapping.sol";

library EnumerableExtensions {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableMapping for EnumerableMapping.AddressToAddressMap;
    using EnumerableMapping for EnumerableMapping.AddressToUintMap;
    using EnumerableMapping for EnumerableMapping.Bytes32ToUIntMap;

    function toArray(EnumerableSet.AddressSet storage addresses)
        internal
        view
        returns (address[] memory)
    {
        uint256 len = addresses.length();
        address[] memory result = new address[](len);
        for (uint256 i; i < len; ) {
            result[i] = addresses.at(i);
            unchecked {
                ++i;
            }
        }
        return result;
    }

    function toArray(EnumerableSet.Bytes32Set storage values)
        internal
        view
        returns (bytes32[] memory)
    {
        uint256 len = values.length();
        bytes32[] memory result = new bytes32[](len);
        for (uint256 i; i < len; ) {
            result[i] = values.at(i);
            unchecked {
                ++i;
            }
        }
        return result;
    }

    function keyAt(EnumerableMapping.AddressToAddressMap storage map, uint256 index)
        internal
        view
        returns (address)
    {
        (address key, ) = map.at(index);
        return key;
    }

    function valueAt(EnumerableMapping.AddressToAddressMap storage map, uint256 index)
        internal
        view
        returns (address)
    {
        (, address value) = map.at(index);
        return value;
    }

    function keyAt(EnumerableMapping.AddressToUintMap storage map, uint256 index)
        internal
        view
        returns (address)
    {
        (address key, ) = map.at(index);
        return key;
    }

    function keyAt(EnumerableMapping.Bytes32ToUIntMap storage map, uint256 index)
        internal
        view
        returns (bytes32)
    {
        (bytes32 key, ) = map.at(index);
        return key;
    }

    function valueAt(EnumerableMapping.AddressToUintMap storage map, uint256 index)
        internal
        view
        returns (uint256)
    {
        (, uint256 value) = map.at(index);
        return value;
    }

    function keysArray(EnumerableMapping.AddressToAddressMap storage map)
        internal
        view
        returns (address[] memory)
    {
        uint256 len = map.length();
        address[] memory result = new address[](len);
        for (uint256 i; i < len; ) {
            result[i] = keyAt(map, i);
            unchecked {
                ++i;
            }
        }
        return result;
    }

    function valuesArray(EnumerableMapping.AddressToAddressMap storage map)
        internal
        view
        returns (address[] memory)
    {
        uint256 len = map.length();
        address[] memory result = new address[](len);
        for (uint256 i; i < len; ) {
            result[i] = valueAt(map, i);
            unchecked {
                ++i;
            }
        }
        return result;
    }

    function keysArray(EnumerableMapping.AddressToUintMap storage map)
        internal
        view
        returns (address[] memory)
    {
        uint256 len = map.length();
        address[] memory result = new address[](len);
        for (uint256 i; i < len; ) {
            result[i] = keyAt(map, i);
            unchecked {
                ++i;
            }
        }
        return result;
    }

    function keysArray(EnumerableMapping.Bytes32ToUIntMap storage map)
        internal
        view
        returns (bytes32[] memory)
    {
        uint256 len = map.length();
        bytes32[] memory result = new bytes32[](len);
        for (uint256 i; i < len; ) {
            result[i] = keyAt(map, i);
            unchecked {
                ++i;
            }
        }
        return result;
    }
}
