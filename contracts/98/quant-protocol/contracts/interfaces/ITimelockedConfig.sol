// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../libraries/ProtocolValue.sol";

interface ITimelockedConfig {
    /// @notice emitted when a protocol address is set in the config
    /// @param protocolAddress the encoded name of the protocol value
    /// @param previousValue the previous value for the protocol address
    /// @param newValue the new value for the protocol address
    event SetProtocolAddress(
        bytes32 protocolAddress,
        address previousValue,
        address newValue
    );

    /// @notice emitted when a protocol uint256 is set in the config
    /// @param protocolUint256 the encoded name of the protocol value
    /// @param previousValue the previous value for the protocol uint256
    /// @param newValue the new value for the protocol uint256
    event SetProtocolUint256(
        bytes32 protocolUint256,
        uint256 previousValue,
        uint256 newValue
    );

    /// @notice emitted when a protocol boolean is set in the config
    /// @param protocolBoolean the encoded name of the protocol value
    /// @param previousValue the previous value for the protocol boolean
    /// @param newValue the new value for the protocol boolean
    event SetProtocolBoolean(
        bytes32 protocolBoolean,
        bool previousValue,
        bool newValue
    );

    /// @notice emitted when a protocol role is set in the config
    /// @param protocolRole the name of the protocol role
    /// @param role the encoded name of the protocol role
    /// @param roleAdmin the address of the role admin
    event SetProtocolRole(string protocolRole, bytes32 role, address roleAdmin);

    /// @notice emitted when a role admin is set
    /// @param role the encoded name of the protocol role
    /// @param adminRole the encoded name of the role to act as an admin
    event SetRoleAdmin(bytes32 role, bytes32 adminRole);

    /// @notice Sets a address protocol value
    /// @param _protocolAddress the encoded name of the protocol address
    /// @param _newValue the new value for the protocol address
    function setProtocolAddress(bytes32 _protocolAddress, address _newValue)
        external;

    /// @notice Sets a uint256 protocol value
    /// @param _protocolUint256 the encoded name of the protocol uint256
    /// @param _newValue the new value for the protocol uint256
    function setProtocolUint256(bytes32 _protocolUint256, uint256 _newValue)
        external;

    /// @notice Sets a boolean protocol value
    /// @param _protocolBoolean the encoded name of the protocol boolean
    /// @param _newValue the new value for the protocol boolean
    function setProtocolBoolean(bytes32 _protocolBoolean, bool _newValue)
        external;

    /// @notice Sets a role protocol
    /// @param _protocolRole the name of the protocol role
    /// @param _roleAdmin the address of the role admin
    function setProtocolRole(string calldata _protocolRole, address _roleAdmin)
        external;

    /// @notice Sets a role admin
    /// @param role the encoded name of the protocol role
    /// @param adminRole the encoded name of the role to act as an admin
    function setRoleAdmin(bytes32 role, bytes32 adminRole) external;

    /// @notice Initializes the system roles and assign them to the given TimelockController address
    /// @param _timelockController Address of the TimelockController to receive the system roles
    /// @dev The TimelockController should have a Quant multisig as its sole proposer
    function initialize(address payable _timelockController) external;

    /// @notice Returns the address of the TimelockController
    function timelockController() external view returns (address payable);

    /// @notice Given an encoded protocol value name, returns the address of the protocol value
    function protocolAddresses(bytes32) external view returns (address);

    /// @notice Given an index, returns the encoded name for a protocol address value
    function configuredProtocolAddresses(uint256)
        external
        view
        returns (bytes32);

    /// @notice Given an encoded protocol value name, returns the uint256 value of the protocol value
    function protocolUints256(bytes32) external view returns (uint256);

    /// @notice Given an index, returns the encoded name for a protocol uint256 value
    function configuredProtocolUints256(uint256)
        external
        view
        returns (bytes32);

    /// @notice Given an encoded protocol value name, returns the boolean value of the protocol value
    function protocolBooleans(bytes32) external view returns (bool);

    /// @notice Given an index, returns the encoded name for a protocol boolean value
    function configuredProtocolBooleans(uint256)
        external
        view
        returns (bytes32);

    /// @notice Given a protocol role name, returns the encoded name of the role
    function quantRoles(string calldata) external view returns (bytes32);

    /// @notice Checks if a given protocol value is already set in the config
    /// @param protocolValueName the encoded name of the protocol value
    /// @param protocolValueType the type of the protocol value
    /// @return whether the protocol value is already set in the config
    function isProtocolValueSet(
        bytes32 protocolValueName,
        ProtocolValue.Type protocolValueType
    ) external view returns (bool);

    /// @notice Array of roles configured in the Quant Protocol system through the QuantConfig
    function configuredQuantRoles(uint256) external view returns (bytes32);

    /// @notice The length of the configuredProtocolAddresses array
    function protocolAddressesLength() external view returns (uint256);

    /// @notice The length of the configuredProtocolUints256 array
    function protocolUints256Length() external view returns (uint256);

    /// @notice The length of the configuredProtocolBooleans array
    function protocolBooleansLength() external view returns (uint256);

    /// @notice The length of the configuredQuantRoles array
    function quantRolesLength() external view returns (uint256);
}
