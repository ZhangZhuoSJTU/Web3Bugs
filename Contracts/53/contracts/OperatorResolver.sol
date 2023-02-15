// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "./interfaces/IOperatorResolver.sol";
import "./MixinOperatorResolver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Operator Resolver implementation
/// @notice Resolve the operators address
contract OperatorResolver is IOperatorResolver, Ownable {
    /// @dev Operators map of the name and address
    mapping(bytes32 => address) public operators;

    /// @inheritdoc IOperatorResolver
    function getAddress(bytes32 name) external view override returns (address) {
        return operators[name];
    }

    /// @inheritdoc IOperatorResolver
    function requireAndGetAddress(bytes32 name, string calldata reason) external view override returns (address) {
        address _foundAddress = operators[name];
        require(_foundAddress != address(0), reason);
        return _foundAddress;
    }

    /// @inheritdoc IOperatorResolver
    function areAddressesImported(bytes32[] calldata names, address[] calldata destinations)
        external
        view
        override
        returns (bool)
    {
        for (uint256 i = 0; i < names.length; i++) {
            if (operators[names[i]] != destinations[i]) {
                return false;
            }
        }
        return true;
    }

    /// @inheritdoc IOperatorResolver
    function importOperators(bytes32[] calldata names, address[] calldata destinations) external override onlyOwner {
        require(names.length == destinations.length, "OperatorResolver::importOperators: Input lengths must match");

        for (uint256 i = 0; i < names.length; i++) {
            bytes32 name = names[i];
            address destination = destinations[i];
            operators[name] = destination;
            emit OperatorImported(name, destination);
        }
    }

    /// @notice rebuild the caches of mixin smart contracts
    /// @param destinations The list of mixinOperatorResolver to rebuild
    function rebuildCaches(MixinOperatorResolver[] calldata destinations) external {
        for (uint256 i = 0; i < destinations.length; i++) {
            destinations[i].rebuildCache();
        }
    }
}
