// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "./TimelockController.sol";
import "../interfaces/IQuantConfig.sol";
import "../libraries/ProtocolValue.sol";

/// @title Timelock controller contract for setting values in the QuantConfig and scheduling calls
/// to external contracts.
/// @author Rolla
/// @dev Built on top of OpenZeppelin's TimelockController.
contract ConfigTimelockController is TimelockController {
    mapping(bytes32 => uint256) public delays;

    mapping(bytes32 => uint256) private _timestamps;

    /// @notice The minimum delay for scheduled executions
    uint256 public minDelay;

    constructor(
        uint256 _minDelay,
        address[] memory _proposers,
        address[] memory _executors
    )
        TimelockController(_minDelay, _proposers, _executors)
    // solhint-disable-next-line no-empty-blocks
    {
        minDelay = _minDelay;
    }

    /// @notice Sets the delay for a specific protocol value
    /// @param _protocolValue the bytes32 encoded representation of the protocol value
    /// @param _newDelay the delay in seconds
    function setDelay(bytes32 _protocolValue, uint256 _newDelay)
        external
        onlyRole(EXECUTOR_ROLE)
    {
        // Delays must be greater than or equal to the minimum delay
        delays[_protocolValue] = _newDelay >= minDelay ? _newDelay : minDelay;
    }

    /// @inheritdoc TimelockController
    function schedule(
        address target,
        uint256 value,
        bytes memory data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay,
        bool
    ) public virtual override onlyRole(PROPOSER_ROLE) {
        require(
            !_isProtocoValueSetter(data),
            "ConfigTimelockController: Can not schedule changes to a protocol value with an arbitrary delay"
        );

        super.schedule(target, value, data, predecessor, salt, delay, false);
    }

    /// @notice Schedule a call to set a protocol address in the QuantConfig contract
    /// @param protocolAddress the encoded name of the protocol address variable to set in the config
    /// @param newAddress the new address value to set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled call can be executed
    function scheduleSetProtocolAddress(
        bytes32 protocolAddress,
        address newAddress,
        address quantConfig,
        uint256 eta
    ) public onlyRole(PROPOSER_ROLE) {
        bytes memory data = _encodeSetProtocolAddress(
            protocolAddress,
            newAddress,
            quantConfig
        );

        uint256 delay = _getProtocolValueDelay(
            quantConfig,
            protocolAddress,
            ProtocolValue.Type.Address
        );

        require(
            eta >= delay + block.timestamp,
            "ConfigTimelockController: Estimated execution block must satisfy delay"
        );

        super.schedule(
            quantConfig,
            0,
            data,
            bytes32(0),
            bytes32(eta),
            delay,
            true
        );
    }

    /// @notice Schedule a call to set a protocol uint256 in the QuantConfig contract
    /// @param protocolUint256 the encoded name of the protocol uint256 variable to set in the config
    /// @param newUint256 the new uint256 value to set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled call can be executed
    function scheduleSetProtocolUint256(
        bytes32 protocolUint256,
        uint256 newUint256,
        address quantConfig,
        uint256 eta
    ) public onlyRole(PROPOSER_ROLE) {
        bytes memory data = _encodeSetProtocolUint256(
            protocolUint256,
            newUint256,
            quantConfig
        );

        uint256 delay = _getProtocolValueDelay(
            quantConfig,
            protocolUint256,
            ProtocolValue.Type.Uint256
        );

        require(
            eta >= delay + block.timestamp,
            "ConfigTimelockController: Estimated execution block must satisfy delay"
        );

        super.schedule(
            quantConfig,
            0,
            data,
            bytes32(0),
            bytes32(eta),
            delay,
            true
        );
    }

    /// @notice Schedule a call to set a protocol boolean in the QuantConfig contract
    /// @param protocolBoolean the encoded name of the protocol boolean variable to set in the config
    /// @param newBoolean the new boolean value to set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled call can be executed
    function scheduleSetProtocolBoolean(
        bytes32 protocolBoolean,
        bool newBoolean,
        address quantConfig,
        uint256 eta
    ) public onlyRole(PROPOSER_ROLE) {
        bytes memory data = _encodeSetProtocolBoolean(
            protocolBoolean,
            newBoolean,
            quantConfig
        );

        uint256 delay = _getProtocolValueDelay(
            quantConfig,
            protocolBoolean,
            ProtocolValue.Type.Bool
        );

        require(
            eta >= delay + block.timestamp,
            "ConfigTimelockController: Estimated execution block must satisfy delay"
        );
        super.schedule(
            quantConfig,
            0,
            data,
            bytes32(0),
            bytes32(eta),
            delay,
            true
        );
    }

    /// @notice Schedule a call to set a protocol role in the QuantConfig contract
    /// @param protocolRole the name of the protocol role variable to set in the config
    /// @param roleAdmin address to be the role admin
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled call can be executed
    function scheduleSetProtocolRole(
        string calldata protocolRole,
        address roleAdmin,
        address quantConfig,
        uint256 eta
    ) public onlyRole(PROPOSER_ROLE) {
        bytes memory data = _encodeSetProtocolRole(
            protocolRole,
            roleAdmin,
            quantConfig
        );

        uint256 delay = _getProtocolValueDelay(
            quantConfig,
            keccak256(abi.encodePacked(protocolRole)),
            ProtocolValue.Type.Role
        );

        require(
            eta >= delay + block.timestamp,
            "ConfigTimelockController: Estimated execution block must satisfy delay"
        );

        super.schedule(
            quantConfig,
            0,
            data,
            bytes32(0),
            bytes32(eta),
            delay,
            true
        );
    }

    /// @notice Schedule multiple contract calls
    /// @dev Cannot schedule calls to set protocol values in the QuantConfig
    /// @param targets array of contracts to receive the scheduled calls
    /// @param values array of values to be sent to the contracts
    /// @param datas array of data to be sent to the contracts
    /// @param predecessor extra 32 bytes to be used when hashing the operation batch
    /// @param salt salt to be used when hashing the operation batch
    /// @param delay execution delay in seconds
    function scheduleBatch(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory datas,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public virtual override onlyRole(PROPOSER_ROLE) {
        uint256 length = targets.length;
        for (uint256 i = 0; i < length; ) {
            require(
                !_isProtocoValueSetter(datas[i]),
                "ConfigTimelockController: Can not schedule changes to a protocol value with an arbitrary delay"
            );
            unchecked {
                ++i;
            }
        }

        super.scheduleBatch(targets, values, datas, predecessor, salt, delay);
    }

    /// @notice Schedule multiple calls to set protocol address values in the QuantConfig
    /// @param protocolValues array of protocol address values to be set
    /// @param newAddresses array of new addresses to be set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled calls can be executed
    function scheduleBatchSetProtocolAddress(
        bytes32[] calldata protocolValues,
        address[] calldata newAddresses,
        address quantConfig,
        uint256 eta
    ) public onlyRole(PROPOSER_ROLE) {
        uint256 length = protocolValues.length;

        require(
            length == newAddresses.length,
            "ConfigTimelockController: length mismatch"
        );

        for (uint256 i = 0; i < length; ) {
            scheduleSetProtocolAddress(
                protocolValues[i],
                newAddresses[i],
                quantConfig,
                eta
            );
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Schedule multiple calls to set protocol uint256 values in the QuantConfig
    /// @param protocolValues array of protocol uint256 values to be set
    /// @param newUints array of new uints to be set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled calls can be executed
    function scheduleBatchSetProtocolUints(
        bytes32[] calldata protocolValues,
        uint256[] calldata newUints,
        address quantConfig,
        uint256 eta
    ) public onlyRole(PROPOSER_ROLE) {
        uint256 length = protocolValues.length;

        require(
            length == newUints.length,
            "ConfigTimelockController: length mismatch"
        );

        for (uint256 i = 0; i < length; ) {
            scheduleSetProtocolUint256(
                protocolValues[i],
                newUints[i],
                quantConfig,
                eta
            );
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Schedule multiple calls to set protocol boolean values in the QuantConfig
    /// @param protocolValues array of protocol boolean values to be set
    /// @param newBooleans array of new booleans to be set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled calls can be executed
    function scheduleBatchSetProtocolBooleans(
        bytes32[] calldata protocolValues,
        bool[] calldata newBooleans,
        address quantConfig,
        uint256 eta
    ) public onlyRole(PROPOSER_ROLE) {
        uint256 length = protocolValues.length;

        require(
            length == newBooleans.length,
            "ConfigTimelockController: length mismatch"
        );

        for (uint256 i = 0; i < length; ) {
            scheduleSetProtocolBoolean(
                protocolValues[i],
                newBooleans[i],
                quantConfig,
                eta
            );
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Schedule multiple calls to set protocol roles in the QuantConfig
    /// @param protocolRoles array of protocol roles to be set
    /// @param roleAdmins array of role admins to be set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled calls can be executed
    function scheduleBatchSetProtocolRoles(
        string[] calldata protocolRoles,
        address[] calldata roleAdmins,
        address quantConfig,
        uint256 eta
    ) public onlyRole(PROPOSER_ROLE) {
        uint256 length = protocolRoles.length;

        require(
            length == roleAdmins.length,
            "ConfigTimelockController: length mismatch"
        );

        for (uint256 i = 0; i < length; ) {
            scheduleSetProtocolRole(
                protocolRoles[i],
                roleAdmins[i],
                quantConfig,
                eta
            );
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Execute a scheduled call to set a protocol address value in the QuantConfig
    /// @param protocolAddress the protocol address value to be set
    /// @param newAddress the new address to be set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled call can be executed
    function executeSetProtocolAddress(
        bytes32 protocolAddress,
        address newAddress,
        address quantConfig,
        uint256 eta
    ) public onlyRole(EXECUTOR_ROLE) {
        execute(
            quantConfig,
            0,
            _encodeSetProtocolAddress(protocolAddress, newAddress, quantConfig),
            bytes32(0),
            bytes32(eta)
        );
    }

    /// @notice Execute a scheduled call to set a protocol uint256 value in the QuantConfig
    /// @param protocolUint256 the protocol uint256 value to be set
    /// @param newUint256 the new uint to be set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled call can be executed
    function executeSetProtocolUint256(
        bytes32 protocolUint256,
        uint256 newUint256,
        address quantConfig,
        uint256 eta
    ) public onlyRole(EXECUTOR_ROLE) {
        execute(
            quantConfig,
            0,
            _encodeSetProtocolUint256(protocolUint256, newUint256, quantConfig),
            bytes32(0),
            bytes32(eta)
        );
    }

    /// @notice Execute a scheduled call to set a protocol boolean value in the QuantConfig
    /// @param protocolBoolean the protocol boolean value to be set
    /// @param newBoolean the new boolean to be set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled call can be executed
    function executeSetProtocolBoolean(
        bytes32 protocolBoolean,
        bool newBoolean,
        address quantConfig,
        uint256 eta
    ) public onlyRole(EXECUTOR_ROLE) {
        execute(
            quantConfig,
            0,
            _encodeSetProtocolBoolean(protocolBoolean, newBoolean, quantConfig),
            bytes32(0),
            bytes32(eta)
        );
    }

    /// @notice Execute a scheduled call to set a protocol role in the QuantConfig
    /// @param protocolRole the protocol role to be set
    /// @param roleAdmin the role admin to be set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled call can be executed
    function executeSetProtocolRole(
        string calldata protocolRole,
        address roleAdmin,
        address quantConfig,
        uint256 eta
    ) public onlyRole(EXECUTOR_ROLE) {
        execute(
            quantConfig,
            0,
            _encodeSetProtocolRole(protocolRole, roleAdmin, quantConfig),
            bytes32(0),
            bytes32(eta)
        );
    }

    /// @notice Execute multiple scheduled calls to set protocol address values in the QuantConfig
    /// @param protocolValues array of protocol address values to be set
    /// @param newAddresses array of new addresses to be set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled calls can be executed
    function executeBatchSetProtocolAddress(
        bytes32[] calldata protocolValues,
        address[] calldata newAddresses,
        address quantConfig,
        uint256 eta
    ) public onlyRole(EXECUTOR_ROLE) {
        uint256 length = protocolValues.length;

        require(
            length == newAddresses.length,
            "ConfigTimelockController: length mismatch"
        );

        for (uint256 i = 0; i < length; ) {
            execute(
                quantConfig,
                0,
                _encodeSetProtocolAddress(
                    protocolValues[i],
                    newAddresses[i],
                    quantConfig
                ),
                bytes32(0),
                bytes32(eta)
            );
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Execute multiple scheduled calls to set protocol uint256 values in the QuantConfig
    /// @param protocolValues array of protocol uint256 values to be set
    /// @param newUints array of new uints to be set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled calls can be executed
    function executeBatchSetProtocolUint256(
        bytes32[] calldata protocolValues,
        uint256[] calldata newUints,
        address quantConfig,
        uint256 eta
    ) public onlyRole(EXECUTOR_ROLE) {
        uint256 length = protocolValues.length;

        require(
            length == newUints.length,
            "ConfigTimelockController: length mismatch"
        );

        for (uint256 i = 0; i < length; ) {
            execute(
                quantConfig,
                0,
                _encodeSetProtocolUint256(
                    protocolValues[i],
                    newUints[i],
                    quantConfig
                ),
                bytes32(0),
                bytes32(eta)
            );
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Execute multiple scheduled calls to set protocol boolean values in the QuantConfig
    /// @param protocolValues array of protocol boolean values to be set
    /// @param newBooleans array of new booleans to be set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled calls can be executed
    function executeBatchSetProtocolBoolean(
        bytes32[] calldata protocolValues,
        bool[] calldata newBooleans,
        address quantConfig,
        uint256 eta
    ) public onlyRole(EXECUTOR_ROLE) {
        uint256 length = protocolValues.length;

        require(
            length == newBooleans.length,
            "ConfigTimelockController: length mismatch"
        );

        for (uint256 i = 0; i < length; ) {
            execute(
                quantConfig,
                0,
                _encodeSetProtocolBoolean(
                    protocolValues[i],
                    newBooleans[i],
                    quantConfig
                ),
                bytes32(0),
                bytes32(eta)
            );
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Execute multiple scheduled calls to set protocol roles in the QuantConfig
    /// @param protocolRoles array of protocol roles to be set
    /// @param roleAdmins array of role admins to be set
    /// @param quantConfig the address of the QuantConfig contract
    /// @param eta timestamp from which the scheduled calls can be executed
    function executeBatchSetProtocolRoles(
        string[] calldata protocolRoles,
        address[] calldata roleAdmins,
        address quantConfig,
        uint256 eta
    ) public onlyRole(EXECUTOR_ROLE) {
        uint256 length = protocolRoles.length;

        require(
            length == roleAdmins.length,
            "ConfigTimelockController: length mismatch"
        );

        for (uint256 i = 0; i < length; ) {
            execute(
                quantConfig,
                0,
                _encodeSetProtocolRole(
                    protocolRoles[i],
                    roleAdmins[i],
                    quantConfig
                ),
                bytes32(0),
                bytes32(eta)
            );
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Gets the delay to set a specific protocol value using the timelock
    /// @param quantConfig  the address of the QuantConfig contract
    /// @param protocolValue the protocol value to get the delay for
    /// @return the delay required to set the protocol value
    function _getProtocolValueDelay(
        address quantConfig,
        bytes32 protocolValue,
        ProtocolValue.Type protocolValueType
    ) internal view returns (uint256) {
        // There shouldn't be a delay when setting a protocol value for the first time
        if (
            !IQuantConfig(quantConfig).isProtocolValueSet(
                protocolValue,
                protocolValueType
            )
        ) {
            return 0;
        }

        uint256 storedDelay = delays[protocolValue];
        return storedDelay != 0 ? storedDelay : minDelay;
    }

    /// @notice Checks if a given calldata is for setting a protocol value, which could be used
    /// to bypass the minimum delay required to set a protocol value of a specific type
    /// @param data the calldata to check
    /// @return true if the calldata is for setting a protocol value, false otherwise
    /// @dev There could be a clash between the 4-byte selector for `setProtocolValue` functions
    /// and other external functions. That's unlikely to happen, but if it does, scheduling calls
    /// to those functions will always revert.
    function _isProtocoValueSetter(bytes memory data)
        internal
        pure
        returns (bool)
    {
        bytes4 selector;

        assembly {
            selector := mload(add(data, 32))
        }

        return
            selector == IQuantConfig(address(0)).setProtocolAddress.selector ||
            selector == IQuantConfig(address(0)).setProtocolUint256.selector ||
            selector == IQuantConfig(address(0)).setProtocolBoolean.selector;
    }

    /// @notice Encodes the calldata for setting a protocol address value
    /// @param _protocolAddress the protocol address value to be set
    /// @param _newAddress the new address to be set
    /// @param _quantConfig the address of the QuantConfig contract
    function _encodeSetProtocolAddress(
        bytes32 _protocolAddress,
        address _newAddress,
        address _quantConfig
    ) internal pure returns (bytes memory) {
        return
            abi.encodeWithSelector(
                IQuantConfig(_quantConfig).setProtocolAddress.selector,
                _protocolAddress,
                _newAddress
            );
    }

    /// @notice Encodes the calldata for setting a protocol uint256 value
    /// @param _protocolUint256 the protocol uint256 value to be set
    /// @param _newUint256 the new uint to be set
    /// @param _quantConfig the address of the QuantConfig contract
    function _encodeSetProtocolUint256(
        bytes32 _protocolUint256,
        uint256 _newUint256,
        address _quantConfig
    ) internal pure returns (bytes memory) {
        return
            abi.encodeWithSelector(
                IQuantConfig(_quantConfig).setProtocolUint256.selector,
                _protocolUint256,
                _newUint256
            );
    }

    /// @notice Encodes the calldata for setting a protocol boolean value
    /// @param _protocolBoolean the protocol boolean value to be set
    /// @param _newBoolean the new boolean to be set
    /// @param _quantConfig the address of the QuantConfig contract
    function _encodeSetProtocolBoolean(
        bytes32 _protocolBoolean,
        bool _newBoolean,
        address _quantConfig
    ) internal pure returns (bytes memory) {
        return
            abi.encodeWithSelector(
                IQuantConfig(_quantConfig).setProtocolBoolean.selector,
                _protocolBoolean,
                _newBoolean
            );
    }

    /// @notice Encodes the calldata for setting a protocol role
    /// @param _protocolRole the protocol role to be set
    /// @param _roleAdmin the role admin to be set
    /// @param _quantConfig the address of the QuantConfig contract
    function _encodeSetProtocolRole(
        string memory _protocolRole,
        address _roleAdmin,
        address _quantConfig
    ) internal pure returns (bytes memory) {
        return
            abi.encodeWithSelector(
                IQuantConfig(_quantConfig).setProtocolRole.selector,
                _protocolRole,
                _roleAdmin
            );
    }
}
