// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

/// @title Operator address resolver interface
interface IOperatorResolver {
    /// @notice Emitted when an operator is imported
    /// @param name The operator name
    /// @param destination The operator address
    event OperatorImported(bytes32 name, address destination);

    /// @notice Get the address of an operator for a given name
    /// @param name The operator name
    /// @return The operator address
    function getAddress(bytes32 name) external view returns (address);

    /// @notice Get the address of an operator for a given but require
    /// the operator to exist.
    /// @param name The operator name
    /// @param reason Require message
    /// @return The operator address
    function requireAndGetAddress(bytes32 name, string calldata reason) external view returns (address);

    /// @notice Check if some addresses are imported with the right name (and vice versa)
    /// @dev The check is performed on the index, make sure that the two arrays match
    /// @param names The operator names
    /// @param destinations The operator addresses
    /// @return True if all the addresses/names are correctly imported, false otherwise
    function areAddressesImported(bytes32[] calldata names, address[] calldata destinations)
        external
        view
        returns (bool);

    /// @notice Import/replace operators
    /// @dev names and destinations arrays must coincide
    /// @param names Operators name
    /// @param destinations Operators address
    function importOperators(bytes32[] calldata names, address[] calldata destinations) external;
}
