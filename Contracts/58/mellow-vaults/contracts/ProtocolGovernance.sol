// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/IProtocolGovernance.sol";
import "./DefaultAccessControl.sol";
import "./libraries/ExceptionsLibrary.sol";

/// @notice Governance that manages all params common for Mellow Permissionless Vaults protocol.
contract ProtocolGovernance is IProtocolGovernance, DefaultAccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;
    uint256 public constant MAX_GOVERNANCE_DELAY = 7 days;

    EnumerableSet.AddressSet private _claimAllowlist;
    address[] private _pendingClaimAllowlistAdd;
    uint256 public pendingClaimAllowlistAddTimestamp;

    address[] private _tokenWhitelist;
    address[] private _pendingTokenWhitelistAdd;
    uint256 private _numberOfValidTokens;
    mapping(address => bool) _tokensAllowed;
    mapping(address => bool) _tokenEverAdded;
    uint256 public pendingTokenWhitelistAddTimestamp;

    EnumerableSet.AddressSet private _vaultGovernances;
    address[] private _pendingVaultGovernancesAdd;
    uint256 public pendingVaultGovernancesAddTimestamp;

    IProtocolGovernance.Params public params;
    Params public pendingParams;

    uint256 public pendingParamsTimestamp;

    /// @notice Creates a new contract.
    /// @param admin Initial admin of the contract
    constructor(address admin) DefaultAccessControl(admin) {
        _tokenWhitelist = new address[](0);
        _numberOfValidTokens = 0;
    }

    // -------------------  PUBLIC, VIEW  -------------------

    /// @inheritdoc IProtocolGovernance
    function claimAllowlist() external view returns (address[] memory) {
        uint256 l = _claimAllowlist.length();
        address[] memory res = new address[](l);
        for (uint256 i = 0; i < l; i++) {
            res[i] = _claimAllowlist.at(i);
        }
        return res;
    }

    /// @inheritdoc IProtocolGovernance
    function tokenWhitelist() external view returns (address[] memory) {
        uint256 l = _tokenWhitelist.length;
        address[] memory res = new address[](_numberOfValidTokens);
        uint256 j = 0;
        for (uint256 i = 0; i < l; i++) {
            if (!_tokensAllowed[_tokenWhitelist[i]] && _tokenEverAdded[_tokenWhitelist[i]]) {
                continue;
            }
            res[j] = _tokenWhitelist[i];
            j += 1;
        }
        return res;
    }

    /// @inheritdoc IProtocolGovernance
    function vaultGovernances() external view returns (address[] memory) {
        uint256 l = _vaultGovernances.length();
        address[] memory res = new address[](l);
        for (uint256 i = 0; i < l; i++) {
            res[i] = _vaultGovernances.at(i);
        }
        return res;
    }

    /// @inheritdoc IProtocolGovernance
    function pendingClaimAllowlistAdd() external view returns (address[] memory) {
        return _pendingClaimAllowlistAdd;
    }

    /// @inheritdoc IProtocolGovernance
    function pendingTokenWhitelistAdd() external view returns (address[] memory) {
        return _pendingTokenWhitelistAdd;
    }

    /// @inheritdoc IProtocolGovernance
    function pendingVaultGovernancesAdd() external view returns (address[] memory) {
        return _pendingVaultGovernancesAdd;
    }

    /// @inheritdoc IProtocolGovernance
    function isAllowedToClaim(address addr) external view returns (bool) {
        return _claimAllowlist.contains(addr);
    }

    /// @inheritdoc IProtocolGovernance
    function isAllowedToken(address addr) external view returns (bool) {
        return _tokenEverAdded[addr] && _tokensAllowed[addr];
    }

    /// @inheritdoc IProtocolGovernance
    function isVaultGovernance(address addr) external view returns (bool) {
        return _vaultGovernances.contains(addr);
    }

    /// @inheritdoc IProtocolGovernance
    function permissionless() external view returns (bool) {
        return params.permissionless;
    }

    /// @inheritdoc IProtocolGovernance
    function maxTokensPerVault() external view returns (uint256) {
        return params.maxTokensPerVault;
    }

    /// @inheritdoc IProtocolGovernance
    function governanceDelay() external view returns (uint256) {
        return params.governanceDelay;
    }

    /// @inheritdoc IProtocolGovernance
    function protocolTreasury() external view returns (address) {
        return params.protocolTreasury;
    }

    // -------------------  PUBLIC, MUTATING, GOVERNANCE, DELAY  -------------------

    /// @inheritdoc IProtocolGovernance
    function setPendingClaimAllowlistAdd(address[] calldata addresses) external {
        require(isAdmin(msg.sender), ExceptionsLibrary.ADMIN);
        _pendingClaimAllowlistAdd = addresses;
        pendingClaimAllowlistAddTimestamp = block.timestamp + params.governanceDelay;
    }

    /// @inheritdoc IProtocolGovernance
    function removeFromClaimAllowlist(address addr) external {
        require(isAdmin(msg.sender), ExceptionsLibrary.ADMIN);
        if (!_claimAllowlist.contains(addr)) {
            return;
        }
        _claimAllowlist.remove(addr);
    }

    /// @inheritdoc IProtocolGovernance
    function setPendingTokenWhitelistAdd(address[] calldata addresses) external {
        require(isAdmin(msg.sender), "ADM");
        _pendingTokenWhitelistAdd = addresses;
        pendingTokenWhitelistAddTimestamp = block.timestamp + params.governanceDelay;
    }

    /// @inheritdoc IProtocolGovernance
    function removeFromTokenWhitelist(address addr) external {
        require(isAdmin(msg.sender), "ADM");
        _tokensAllowed[addr] = false;
        if (_tokenEverAdded[addr]) {
            --_numberOfValidTokens;
        }
    }

    /// @inheritdoc IProtocolGovernance
    function setPendingVaultGovernancesAdd(address[] calldata addresses) external {
        require(isAdmin(msg.sender), ExceptionsLibrary.ADMIN);
        _pendingVaultGovernancesAdd = addresses;
        pendingVaultGovernancesAddTimestamp = block.timestamp + params.governanceDelay;
    }

    /// @inheritdoc IProtocolGovernance
    function removeFromVaultGovernances(address addr) external {
        require(isAdmin(msg.sender), ExceptionsLibrary.ADMIN);
        if (!_vaultGovernances.contains(addr)) {
            return;
        }
        _vaultGovernances.remove(addr);
    }

    /// @inheritdoc IProtocolGovernance
    function setPendingParams(IProtocolGovernance.Params memory newParams) external {
        require(isAdmin(msg.sender), ExceptionsLibrary.ADMIN);
        require(params.governanceDelay <= MAX_GOVERNANCE_DELAY, ExceptionsLibrary.MAX_GOVERNANCE_DELAY);
        pendingParams = newParams;
        pendingParamsTimestamp = block.timestamp + params.governanceDelay;
    }

    // -------------------  PUBLIC, MUTATING, GOVERNANCE, IMMEDIATE  -------------------

    /// @inheritdoc IProtocolGovernance
    function commitClaimAllowlistAdd() external {
        require(isAdmin(msg.sender), ExceptionsLibrary.ADMIN);
        require(
            (block.timestamp >= pendingClaimAllowlistAddTimestamp) && (pendingClaimAllowlistAddTimestamp > 0),
            ExceptionsLibrary.TIMESTAMP
        );
        for (uint256 i = 0; i < _pendingClaimAllowlistAdd.length; i++) {
            _claimAllowlist.add(_pendingClaimAllowlistAdd[i]);
        }
        delete _pendingClaimAllowlistAdd;
        delete pendingClaimAllowlistAddTimestamp;
    }

    /// @inheritdoc IProtocolGovernance
    function commitTokenWhitelistAdd() external {
        require(isAdmin(msg.sender), "ADM");
        require(
            (block.timestamp >= pendingTokenWhitelistAddTimestamp) && (pendingTokenWhitelistAddTimestamp > 0),
            "TS"
        );
        for (uint256 i = 0; i < _pendingTokenWhitelistAdd.length; i++) {
            if (!_tokenEverAdded[_pendingTokenWhitelistAdd[i]]) {
                _numberOfValidTokens += 1;
                _tokensAllowed[_pendingTokenWhitelistAdd[i]] = true;
                _tokenWhitelist.push(_pendingTokenWhitelistAdd[i]);
                _tokenEverAdded[_pendingTokenWhitelistAdd[i]] = true;
            } else {
                if (!_tokensAllowed[_pendingTokenWhitelistAdd[i]]) {
                    _numberOfValidTokens += 1;
                    _tokensAllowed[_pendingTokenWhitelistAdd[i]] = true;
                }
            }
        }
        delete _pendingTokenWhitelistAdd;
        delete pendingTokenWhitelistAddTimestamp;
    }

    /// @inheritdoc IProtocolGovernance
    function commitVaultGovernancesAdd() external {
        require(isAdmin(msg.sender), ExceptionsLibrary.ADMIN);
        require(
            (block.timestamp >= pendingVaultGovernancesAddTimestamp) && (pendingVaultGovernancesAddTimestamp > 0),
            ExceptionsLibrary.TIMESTAMP
        );
        for (uint256 i = 0; i < _pendingVaultGovernancesAdd.length; i++) {
            _vaultGovernances.add(_pendingVaultGovernancesAdd[i]);
        }
        delete _pendingVaultGovernancesAdd;
        delete pendingVaultGovernancesAddTimestamp;
    }

    /// @inheritdoc IProtocolGovernance
    function commitParams() external {
        require(isAdmin(msg.sender), ExceptionsLibrary.ADMIN);
        require(block.timestamp >= pendingParamsTimestamp, ExceptionsLibrary.TIMESTAMP);
        require(pendingParams.maxTokensPerVault > 0 || pendingParams.governanceDelay > 0, ExceptionsLibrary.EMPTY_PARAMS); // sanity check for empty params
        params = pendingParams;
        delete pendingParams;
        delete pendingParamsTimestamp;
    }
}
