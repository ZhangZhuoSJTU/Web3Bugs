// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../interfaces/IGasBank.sol";
import "../interfaces/IAddressProvider.sol";
import "../interfaces/IStakerVault.sol";
import "../interfaces/oracles/IOracleProvider.sol";

import "../libraries/EnumerableExtensions.sol";
import "../libraries/EnumerableMapping.sol";
import "../libraries/AddressProviderKeys.sol";
import "../libraries/AddressProviderMeta.sol";
import "../libraries/Roles.sol";

import "./access/AuthorizationBase.sol";
import "./utils/Preparable.sol";

// solhint-disable ordering

contract AddressProvider is IAddressProvider, AuthorizationBase, Initializable, Preparable {
    using EnumerableMapping for EnumerableMapping.AddressToAddressMap;
    using EnumerableMapping for EnumerableMapping.Bytes32ToUIntMap;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableExtensions for EnumerableSet.AddressSet;
    using EnumerableExtensions for EnumerableSet.Bytes32Set;
    using EnumerableExtensions for EnumerableMapping.AddressToAddressMap;
    using EnumerableExtensions for EnumerableMapping.Bytes32ToUIntMap;
    using AddressProviderMeta for AddressProviderMeta.Meta;

    // LpToken -> stakerVault
    EnumerableMapping.AddressToAddressMap internal _stakerVaults;

    EnumerableSet.AddressSet internal _whiteListedFeeHandlers;

    // value is encoded as (bool freezable, bool frozen)
    EnumerableMapping.Bytes32ToUIntMap internal _addressKeyMetas;

    EnumerableSet.AddressSet internal _actions; // list of all actions ever registered

    EnumerableSet.AddressSet internal _vaults; // list of all active vaults

    EnumerableMapping.AddressToAddressMap internal _tokenToPools;

    constructor(address treasury) {
        AddressProviderMeta.Meta memory meta = AddressProviderMeta.Meta(true, false);
        _addressKeyMetas.set(AddressProviderKeys._TREASURY_KEY, meta.toUInt());
        _setConfig(AddressProviderKeys._TREASURY_KEY, treasury);
    }

    function initialize(address roleManager) external initializer {
        AddressProviderMeta.Meta memory meta = AddressProviderMeta.Meta(true, true);
        _addressKeyMetas.set(AddressProviderKeys._ROLE_MANAGER_KEY, meta.toUInt());
        _setConfig(AddressProviderKeys._ROLE_MANAGER_KEY, roleManager);
    }

    function getKnownAddressKeys() external view override returns (bytes32[] memory) {
        return _addressKeyMetas.keysArray();
    }

    function addFeeHandler(address feeHandler) external override onlyGovernance returns (bool) {
        require(!_whiteListedFeeHandlers.contains(feeHandler), Error.ADDRESS_WHITELISTED);
        _whiteListedFeeHandlers.add(feeHandler);
        emit FeeHandlerAdded(feeHandler);
        return true;
    }

    function removeFeeHandler(address feeHandler) external override onlyGovernance returns (bool) {
        require(_whiteListedFeeHandlers.contains(feeHandler), Error.ADDRESS_NOT_WHITELISTED);
        _whiteListedFeeHandlers.remove(feeHandler);
        emit FeeHandlerRemoved(feeHandler);
        return true;
    }

    /**
     * @notice Adds action.
     * @param action Address of action to add.
     */
    function addAction(address action) external override onlyGovernance returns (bool) {
        bool result = _actions.add(action);
        if (result) {
            emit ActionListed(action);
        }
        return result;
    }

    /**
     * @notice Adds pool.
     * @param pool Address of pool to add.
     */
    function addPool(address pool)
        external
        override
        onlyRoles2(Roles.POOL_FACTORY, Roles.GOVERNANCE)
    {
        require(pool != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);

        ILiquidityPool ipool = ILiquidityPool(pool);
        address poolToken = ipool.getLpToken();
        require(poolToken != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        if (_tokenToPools.set(poolToken, pool)) {
            address vault = address(ipool.getVault());
            if (vault != address(0)) {
                _vaults.add(vault);
            }
            emit PoolListed(pool);
        }
    }

    /**
     * @notice Delists pool.
     * @param pool Address of pool to delist.
     * @return `true` if successful.
     */
    function removePool(address pool) external override onlyRole(Roles.CONTROLLER) returns (bool) {
        address lpToken = ILiquidityPool(pool).getLpToken();
        bool removed = _tokenToPools.remove(lpToken);
        if (removed) {
            address vault = address(ILiquidityPool(pool).getVault());
            if (vault != address(0)) {
                _vaults.remove(vault);
            }
            emit PoolDelisted(pool);
        }

        return removed;
    }

    /** Vault functions  */

    /**
     * @notice returns all the registered vaults
     */
    function allVaults() external view override returns (address[] memory) {
        return _vaults.toArray();
    }

    /**
     * @notice returns the vault at the given index
     */
    function getVaultAtIndex(uint256 index) external view override returns (address) {
        return _vaults.at(index);
    }

    /**
     * @notice returns the number of vaults
     */
    function vaultsCount() external view override returns (uint256) {
        return _vaults.length();
    }

    function isVault(address vault) external view override returns (bool) {
        return _vaults.contains(vault);
    }

    function updateVault(address previousVault, address newVault)
        external
        override
        onlyRole(Roles.POOL)
    {
        if (previousVault != address(0)) {
            _vaults.remove(previousVault);
        }
        if (newVault != address(0)) {
            _vaults.add(newVault);
        }
        emit VaultUpdated(previousVault, newVault);
    }

    /**
     * @notice Returns the address for the given key
     */
    function getAddress(bytes32 key) public view override returns (address) {
        require(_addressKeyMetas.contains(key), Error.ADDRESS_DOES_NOT_EXIST);
        return currentAddresses[key];
    }

    /**
     * @notice Returns the address for the given key
     * @dev if `checkExists` is true, it will fail if the key does not exist
     */
    function getAddress(bytes32 key, bool checkExists) public view override returns (address) {
        require(!checkExists || _addressKeyMetas.contains(key), Error.ADDRESS_DOES_NOT_EXIST);
        return currentAddresses[key];
    }

    /**
     * @notice returns the address metadata for the given key
     */
    function getAddressMeta(bytes32 key)
        public
        view
        override
        returns (AddressProviderMeta.Meta memory)
    {
        (bool exists, uint256 metadata) = _addressKeyMetas.tryGet(key);
        require(exists, Error.ADDRESS_DOES_NOT_EXIST);
        return AddressProviderMeta.fromUInt(metadata);
    }

    function initializeAddress(bytes32 key, address initialAddress) external override {
        initializeAddress(key, initialAddress, false);
    }

    /**
     * @notice Initializes an address
     * @param key Key to initialize
     * @param initialAddress Address for `key`
     */
    function initializeAddress(
        bytes32 key,
        address initialAddress,
        bool freezable
    ) public override onlyGovernance {
        AddressProviderMeta.Meta memory meta = AddressProviderMeta.Meta(freezable, false);
        _initializeAddress(key, initialAddress, meta);
    }

    /**
     * @notice Initializes and freezes address
     * @param key Key to initialize
     * @param initialAddress Address for `key`
     */
    function initializeAndFreezeAddress(bytes32 key, address initialAddress)
        external
        override
        onlyGovernance
    {
        AddressProviderMeta.Meta memory meta = AddressProviderMeta.Meta(true, true);
        _initializeAddress(key, initialAddress, meta);
    }

    /**
     * @notice Freezes a configuration key, making it immutable
     * @param key Key to feeze
     */
    function freezeAddress(bytes32 key) external override onlyGovernance {
        AddressProviderMeta.Meta memory meta = getAddressMeta(key);
        require(!meta.frozen, Error.ADDRESS_FROZEN);
        require(meta.freezable, Error.INVALID_ARGUMENT);
        meta.frozen = true;
        _addressKeyMetas.set(key, meta.toUInt());
    }

    /**
     * @notice Prepare update of an address
     * @param key Key to update
     * @param newAddress New address for `key`
     * @return `true` if successful.
     */
    function prepareAddress(bytes32 key, address newAddress)
        external
        override
        onlyGovernance
        returns (bool)
    {
        AddressProviderMeta.Meta memory meta = getAddressMeta(key);
        require(!meta.frozen, Error.ADDRESS_FROZEN);
        return _prepare(key, newAddress);
    }

    /**
     * @notice Execute update of `key`
     * @return New address.
     */
    function executeAddress(bytes32 key) external override returns (address) {
        AddressProviderMeta.Meta memory meta = getAddressMeta(key);
        require(!meta.frozen, Error.ADDRESS_FROZEN);
        return _executeAddress(key);
    }

    /**
     * @notice Reset `key`
     * @return true if it was reset
     */
    function resetAddress(bytes32 key) external override onlyGovernance returns (bool) {
        return _resetAddressConfig(key);
    }

    /**
     * @notice Add a new staker vault.
     * @dev This fails if the token of the staker vault is the token of an existing staker vault.
     * @param stakerVault Vault to add.
     * @return `true` if successful.
     */
    function addStakerVault(address stakerVault)
        external
        override
        onlyRole(Roles.CONTROLLER)
        returns (bool)
    {
        address token = IStakerVault(stakerVault).getToken();
        require(token != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        require(!_stakerVaults.contains(token), Error.STAKER_VAULT_EXISTS);
        _stakerVaults.set(token, stakerVault);
        emit StakerVaultListed(stakerVault);
        return true;
    }

    function isWhiteListedFeeHandler(address feeHandler) external view override returns (bool) {
        return _whiteListedFeeHandlers.contains(feeHandler);
    }

    /**
     * @notice Get the liquidity pool for a given token
     * @dev Does not revert if the pool does not exist
     * @param token Token for which to get the pool.
     * @return Pool address.
     */
    function safeGetPoolForToken(address token) external view override returns (address) {
        (, address poolAddress) = _tokenToPools.tryGet(token);
        return poolAddress;
    }

    /**
     * @notice Get the liquidity pool for a given token
     * @dev Reverts if the pool does not exist
     * @param token Token for which to get the pool.
     * @return Pool address.
     */
    function getPoolForToken(address token) external view override returns (ILiquidityPool) {
        (bool exists, address poolAddress) = _tokenToPools.tryGet(token);
        require(exists, Error.ADDRESS_NOT_FOUND);
        return ILiquidityPool(poolAddress);
    }

    /**
     * @notice Get list of all action addresses.
     * @return Array with action addresses.
     */
    function allActions() external view override returns (address[] memory) {
        return _actions.toArray();
    }

    /**
     * @notice Check whether an address is an action.
     * @param action Address to check whether it is action.
     * @return True if address is an action.
     */
    function isAction(address action) external view override returns (bool) {
        return _actions.contains(action);
    }

    /**
     * @notice Check whether an address is a pool.
     * @param pool Address to check whether it is a pool.
     * @return True if address is a pool.
     */
    function isPool(address pool) external view override returns (bool) {
        address lpToken = ILiquidityPool(pool).getLpToken();
        (bool exists, address poolAddress) = _tokenToPools.tryGet(lpToken);
        return exists && pool == poolAddress;
    }

    /**
     * @notice Get list of all pool addresses.
     * @return Array with pool addresses.
     */
    function allPools() external view override returns (address[] memory) {
        return _tokenToPools.valuesArray();
    }

    /**
     * @notice returns the pool at the given index
     */
    function getPoolAtIndex(uint256 index) external view override returns (address) {
        return _tokenToPools.valueAt(index);
    }

    /**
     * @notice returns the number of pools
     */
    function poolsCount() external view override returns (uint256) {
        return _tokenToPools.length();
    }

    /**
     * @notice Returns all the staker vaults.
     */
    function allStakerVaults() external view override returns (address[] memory) {
        return _stakerVaults.valuesArray();
    }

    /**
     * @notice Get the staker vault for a given token
     * @dev There can only exist one staker vault per unique token.
     * @param token Token for which to get the vault.
     * @return Vault address.
     */
    function getStakerVault(address token) external view override returns (address) {
        return _stakerVaults.get(token);
    }

    /**
     * @notice Tries to get the staker vault for a given token but does not throw if it does not exist
     * @return A boolean set to true if the vault exists and the vault address.
     */
    function tryGetStakerVault(address token) external view override returns (bool, address) {
        return _stakerVaults.tryGet(token);
    }

    /**
     * @notice Check if a vault is registered (exists).
     * @param stakerVault Address of staker vault to check.
     * @return `true` if registered, `false` if not.
     */
    function isStakerVaultRegistered(address stakerVault) external view override returns (bool) {
        address token = IStakerVault(stakerVault).getToken();
        return isStakerVault(stakerVault, token);
    }

    function isStakerVault(address stakerVault, address token) public view override returns (bool) {
        (bool exists, address vault) = _stakerVaults.tryGet(token);
        return exists && vault == stakerVault;
    }

    function _roleManager() internal view override returns (IRoleManager) {
        return IRoleManager(getAddress(AddressProviderKeys._ROLE_MANAGER_KEY));
    }

    function _initializeAddress(
        bytes32 key,
        address initialAddress,
        AddressProviderMeta.Meta memory meta
    ) internal {
        require(!_addressKeyMetas.contains(key), Error.INVALID_ARGUMENT);
        _addKnownAddressKey(key, meta);
        _setConfig(key, initialAddress);
    }

    function _addKnownAddressKey(bytes32 key, AddressProviderMeta.Meta memory meta) internal {
        require(_addressKeyMetas.set(key, meta.toUInt()), Error.INVALID_ARGUMENT);
        emit KnownAddressKeyAdded(key);
    }
}
