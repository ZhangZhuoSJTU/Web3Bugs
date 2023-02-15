// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "./OperatorResolver.sol";

/// @title Mixin operator resolver
/// @notice Store in cache operators name and address
abstract contract MixinOperatorResolver {
    /// @notice Emitted when cache is updated
    /// @param name The operator name
    /// @param destination The operator address
    event CacheUpdated(bytes32 name, address destination);

    /// @dev The OperatorResolver used to build the cache
    OperatorResolver public resolver;

    /// @dev Cache operators map of the name and address
    mapping(bytes32 => address) private addressCache;

    constructor(address _resolver) {
        resolver = OperatorResolver(_resolver);
    }

    /// @dev This function is public not external in order for it to be overridden and
    /// invoked via super in subclasses
    function resolverAddressesRequired() public view virtual returns (bytes32[] memory addresses) {}

    /// @notice Rebuild the addressCache
    function rebuildCache() public {
        bytes32[] memory requiredAddresses = resolverAddressesRequired();
        // The resolver must call this function whenever it updates its state
        for (uint256 i = 0; i < requiredAddresses.length; i++) {
            bytes32 name = requiredAddresses[i];
            // Note: can only be invoked once the resolver has all the targets needed added
            address destination = resolver.getAddress(name);
            if (destination != address(0)) {
                addressCache[name] = destination;
            } else {
                delete addressCache[name];
            }
            emit CacheUpdated(name, destination);
        }
    }

    /// @notice Check the state of addressCache
    function isResolverCached() external view returns (bool) {
        bytes32[] memory requiredAddresses = resolverAddressesRequired();
        for (uint256 i = 0; i < requiredAddresses.length; i++) {
            bytes32 name = requiredAddresses[i];
            // false if our cache is invalid or if the resolver doesn't have the required address
            if (resolver.getAddress(name) != addressCache[name] || addressCache[name] == address(0)) {
                return false;
            }
        }
        return true;
    }

    /// @dev Get operator address in cache and require (if exists)
    /// @param name The operator name
    /// @return The operator address
    function requireAndGetAddress(bytes32 name) internal view returns (address) {
        address _foundAddress = addressCache[name];
        require(_foundAddress != address(0), string(abi.encodePacked("Missing operator : ", name)));
        return _foundAddress;
    }
}
