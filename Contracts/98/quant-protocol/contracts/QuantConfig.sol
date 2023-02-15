// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./libraries/ProtocolValue.sol";
import "./interfaces/ITimelockedConfig.sol";

/// @title A central config for the Quant Protocol. Also acts as a central access control manager.
/// @author Rolla
/// @notice For storing constants, variables and allowing them to be changed by the admin (governance)
/// @dev This should be used as a central access control manager which other contracts use to check permissions
contract QuantConfig is
    AccessControlUpgradeable,
    OwnableUpgradeable,
    ITimelockedConfig
{
    /// @inheritdoc ITimelockedConfig
    address payable public override timelockController;

    /// @inheritdoc ITimelockedConfig
    mapping(bytes32 => address) public override protocolAddresses;
    /// @inheritdoc ITimelockedConfig
    bytes32[] public override configuredProtocolAddresses;

    /// @inheritdoc ITimelockedConfig
    mapping(bytes32 => uint256) public override protocolUints256;
    /// @inheritdoc ITimelockedConfig
    bytes32[] public override configuredProtocolUints256;

    /// @inheritdoc ITimelockedConfig
    mapping(bytes32 => bool) public override protocolBooleans;
    /// @inheritdoc ITimelockedConfig
    bytes32[] public override configuredProtocolBooleans;

    /// @inheritdoc ITimelockedConfig
    mapping(string => bytes32) public override quantRoles;
    /// @inheritdoc ITimelockedConfig
    bytes32[] public override configuredQuantRoles;

    /// @inheritdoc ITimelockedConfig
    mapping(bytes32 => mapping(ProtocolValue.Type => bool))
        public
        override isProtocolValueSet;

    /// @inheritdoc ITimelockedConfig
    function setProtocolAddress(bytes32 _protocolAddress, address _newValue)
        external
        override
        onlyOwner
    {
        require(
            _protocolAddress != ProtocolValue.encode("priceRegistry") ||
                !protocolBooleans[ProtocolValue.encode("isPriceRegistrySet")],
            "QuantConfig: priceRegistry can only be set once"
        );
        address previousValue = protocolAddresses[_protocolAddress];
        protocolAddresses[_protocolAddress] = _newValue;
        configuredProtocolAddresses.push(_protocolAddress);
        isProtocolValueSet[_protocolAddress][ProtocolValue.Type.Address] = true;

        if (_protocolAddress == ProtocolValue.encode("priceRegistry")) {
            protocolBooleans[ProtocolValue.encode("isPriceRegistrySet")] = true;
        }

        emit SetProtocolAddress(_protocolAddress, previousValue, _newValue);
    }

    /// @inheritdoc ITimelockedConfig
    function setProtocolUint256(bytes32 _protocolUint256, uint256 _newValue)
        external
        override
        onlyOwner
    {
        uint256 previousValue = protocolUints256[_protocolUint256];
        protocolUints256[_protocolUint256] = _newValue;
        configuredProtocolUints256.push(_protocolUint256);
        isProtocolValueSet[_protocolUint256][ProtocolValue.Type.Uint256] = true;

        emit SetProtocolUint256(_protocolUint256, previousValue, _newValue);
    }

    /// @inheritdoc ITimelockedConfig
    function setProtocolBoolean(bytes32 _protocolBoolean, bool _newValue)
        external
        override
        onlyOwner
    {
        require(
            _protocolBoolean != ProtocolValue.encode("isPriceRegistrySet") ||
                !protocolBooleans[ProtocolValue.encode("isPriceRegistrySet")],
            "QuantConfig: can only change isPriceRegistrySet once"
        );
        bool previousValue = protocolBooleans[_protocolBoolean];
        protocolBooleans[_protocolBoolean] = _newValue;
        configuredProtocolBooleans.push(_protocolBoolean);
        isProtocolValueSet[_protocolBoolean][ProtocolValue.Type.Bool] = true;

        emit SetProtocolBoolean(_protocolBoolean, previousValue, _newValue);
    }

    /// @inheritdoc ITimelockedConfig
    function setProtocolRole(string calldata _protocolRole, address _roleAdmin)
        external
        override
        onlyOwner
    {
        _setProtocolRole(_protocolRole, _roleAdmin);
    }

    /// @inheritdoc ITimelockedConfig
    function setRoleAdmin(bytes32 role, bytes32 adminRole)
        external
        override
        onlyOwner
    {
        _setRoleAdmin(role, adminRole);

        emit SetRoleAdmin(role, adminRole);
    }

    /// @inheritdoc ITimelockedConfig
    function protocolAddressesLength()
        external
        view
        override
        returns (uint256)
    {
        return configuredProtocolAddresses.length;
    }

    /// @inheritdoc ITimelockedConfig
    function protocolUints256Length() external view override returns (uint256) {
        return configuredProtocolUints256.length;
    }

    /// @inheritdoc ITimelockedConfig
    function protocolBooleansLength() external view override returns (uint256) {
        return configuredProtocolBooleans.length;
    }

    /// @inheritdoc ITimelockedConfig
    function quantRolesLength() external view override returns (uint256) {
        return configuredQuantRoles.length;
    }

    /// @inheritdoc ITimelockedConfig
    function initialize(address payable _timelockController)
        public
        override
        initializer
    {
        require(
            _timelockController != address(0),
            "QuantConfig: invalid TimelockController address"
        );

        __AccessControl_init();
        __Ownable_init_unchained();
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(DEFAULT_ADMIN_ROLE, _timelockController);

        string memory oracleManagerRole = "ORACLE_MANAGER_ROLE";
        _setProtocolRole(oracleManagerRole, _timelockController);
        _setProtocolRole(oracleManagerRole, _msgSender());
        timelockController = _timelockController;
    }

    /// @notice Sets a new protocol role, while also assigning a role admin
    /// @dev If the role already exists in the config, only the role admin will be changed
    function _setProtocolRole(string memory _protocolRole, address _roleAdmin)
        internal
    {
        bytes32 role = keccak256(abi.encodePacked(_protocolRole));
        grantRole(role, _roleAdmin);
        if (quantRoles[_protocolRole] == bytes32(0)) {
            quantRoles[_protocolRole] = role;
            configuredQuantRoles.push(role);
            isProtocolValueSet[role][ProtocolValue.Type.Role] = true;
        }

        emit SetProtocolRole(_protocolRole, role, _roleAdmin);
    }
}
