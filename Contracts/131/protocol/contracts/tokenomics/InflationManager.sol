// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../interfaces/IStakerVault.sol";
import "../../interfaces/tokenomics/IInflationManager.sol";
import "../../interfaces/tokenomics/IKeeperGauge.sol";
import "../../interfaces/tokenomics/IAmmGauge.sol";

import "../../libraries/EnumerableMapping.sol";
import "../../libraries/EnumerableExtensions.sol";
import "../../libraries/AddressProviderHelpers.sol";
import "../../libraries/UncheckedMath.sol";

import "./Minter.sol";
import "../utils/Preparable.sol";
import "../access/Authorization.sol";

contract InflationManager is Authorization, IInflationManager, Preparable {
    using UncheckedMath for uint256;
    using EnumerableMapping for EnumerableMapping.AddressToAddressMap;
    using EnumerableExtensions for EnumerableMapping.AddressToAddressMap;
    using AddressProviderHelpers for IAddressProvider;

    IAddressProvider public immutable addressProvider;

    bytes32 internal constant _KEEPER_WEIGHT_KEY = "keeperWeight";
    bytes32 internal constant _AMM_WEIGHT_KEY = "ammWeight";
    bytes32 internal constant _LP_WEIGHT_KEY = "lpWeight";

    address public minter;
    bool public weightBasedKeeperDistributionDeactivated;
    uint256 public totalKeeperPoolWeight;
    uint256 public totalLpPoolWeight;
    uint256 public totalAmmTokenWeight;

    // Pool -> keeperGauge
    EnumerableMapping.AddressToAddressMap private _keeperGauges;
    // AMM token -> ammGauge
    EnumerableMapping.AddressToAddressMap private _ammGauges;

    mapping(address => bool) public gauges;

    event NewKeeperWeight(address indexed pool, uint256 newWeight);
    event NewLpWeight(address indexed pool, uint256 newWeight);
    event NewAmmTokenWeight(address indexed token, uint256 newWeight);

    modifier onlyGauge() {
        require(gauges[msg.sender], Error.UNAUTHORIZED_ACCESS);
        _;
    }

    constructor(IAddressProvider _addressProvider)
        Authorization(_addressProvider.getRoleManager())
    {
        addressProvider = _addressProvider;
    }

    function setMinter(address _minter) external override onlyGovernance returns (bool) {
        require(minter == address(0), Error.ADDRESS_ALREADY_SET);
        require(_minter != address(0), Error.INVALID_MINTER);
        minter = _minter;
        return true;
    }

    /**
     * @notice Advance the keeper gauge for a pool by on epoch.
     * @param pool Pool for which the keeper gauge is advanced.
     * @return `true` if successful.
     */
    function advanceKeeperGaugeEpoch(address pool) external override onlyGovernance returns (bool) {
        IKeeperGauge(_keeperGauges.get(pool)).advanceEpoch();
        return true;
    }

    /**
     * @notice Mints BKD tokens.
     * @param beneficiary Address to receive the tokens.
     * @param amount Amount of tokens to mint.
     */
    function mintRewards(address beneficiary, uint256 amount) external override onlyGauge {
        Minter(minter).mint(beneficiary, amount);
    }

    /**
     * @notice Deactivates the weight-based distribution of keeper inflation.
     * @dev This can only be done once, when the keeper inflation mechanism is altered.
     * @return `true` if successful.
     */
    function deactivateWeightBasedKeeperDistribution()
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(!weightBasedKeeperDistributionDeactivated, "Weight-based dist. deactivated.");
        address[] memory liquidityPools = addressProvider.allPools();
        uint256 length = liquidityPools.length;
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            _removeKeeperGauge(address(liquidityPools[i]));
        }
        weightBasedKeeperDistributionDeactivated = true;
        return true;
    }

    /**
     * @notice Checkpoints all gauges.
     * @dev This is mostly used upon inflation rate updates.
     * @return `true` if successful.
     */
    function checkpointAllGauges() external override returns (bool) {
        uint256 length = _keeperGauges.length();
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            IKeeperGauge(_keeperGauges.valueAt(i)).poolCheckpoint();
        }
        address[] memory stakerVaults = addressProvider.allStakerVaults();
        for (uint256 i; i < stakerVaults.length; i = i.uncheckedInc()) {
            IStakerVault(stakerVaults[i]).poolCheckpoint();
        }

        length = _ammGauges.length();
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            IAmmGauge(_ammGauges.valueAt(i)).poolCheckpoint();
        }
        return true;
    }

    /**
     * @notice Prepare update of a keeper pool weight (with time delay enforced).
     * @param pool Pool to update the keeper weight for.
     * @param newPoolWeight New weight for the keeper inflation for the pool.
     * @return `true` if successful.
     */
    function prepareKeeperPoolWeight(address pool, uint256 newPoolWeight)
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(_keeperGauges.contains(pool), Error.INVALID_ARGUMENT);
        bytes32 key = _getKeeperGaugeKey(pool);
        _prepare(key, newPoolWeight);
        return true;
    }

    /**
     * @notice Execute update of keeper pool weight (with time delay enforced).
     * @param pool Pool to execute the keeper weight update for.
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New keeper pool weight.
     */
    function executeKeeperPoolWeight(address pool) external override returns (uint256) {
        bytes32 key = _getKeeperGaugeKey(pool);
        _executeKeeperPoolWeight(key, pool, isInflationWeightManager(msg.sender));
        return currentUInts256[key];
    }

    /**
     * @notice Prepare update of a batch of keeperGauge weights (with time delay enforced).
     * @dev Each entry in the pools array corresponds to an entry in the weights array.
     * @param pools Pools to update the keeper weight for.
     * @param weights New weights for the keeper inflation for the pools.
     * @return `true` if successful.
     */
    function batchPrepareKeeperPoolWeights(address[] calldata pools, uint256[] calldata weights)
        external
        override
        onlyGovernance
        returns (bool)
    {
        uint256 length = pools.length;
        require(length == weights.length, Error.INVALID_ARGUMENT);
        bytes32 key;
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            require(_keeperGauges.contains(pools[i]), Error.INVALID_ARGUMENT);
            key = _getKeeperGaugeKey(pools[i]);
            _prepare(key, weights[i]);
        }
        return true;
    }

    function whitelistGauge(address gauge) external override onlyRole(Roles.CONTROLLER) {
        gauges[gauge] = true;
    }

    /**
     * @notice Execute weight updates for a batch of _keeperGauges.
     * @param pools Pools to execute the keeper weight updates for.
     * @return `true` if successful.
     */
    function batchExecuteKeeperPoolWeights(address[] calldata pools)
        external
        override
        onlyRoles2(Roles.GOVERNANCE, Roles.INFLATION_MANAGER)
        returns (bool)
    {
        uint256 length = pools.length;
        bytes32 key;
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            key = _getKeeperGaugeKey(pools[i]);
            _executeKeeperPoolWeight(key, pools[i], isInflationWeightManager(msg.sender));
        }
        return true;
    }

    function removeStakerVaultFromInflation(address stakerVault, address lpToken)
        external
        override
        onlyRole(Roles.CONTROLLER)
    {
        bytes32 key = _getLpStakerVaultKey(stakerVault);
        _prepare(key, 0);
        _executeLpPoolWeight(key, lpToken, stakerVault, true);
    }

    /**
     * @notice Prepare update of a lp pool weight (with time delay enforced).
     * @param lpToken LP token to update the weight for.
     * @param newPoolWeight New LP inflation weight.
     * @return `true` if successful.
     */
    function prepareLpPoolWeight(address lpToken, uint256 newPoolWeight)
        external
        override
        onlyRoles2(Roles.GOVERNANCE, Roles.INFLATION_MANAGER)
        returns (bool)
    {
        address stakerVault = addressProvider.getStakerVault(lpToken);
        // Require both that gauge is registered and that pool is still in action
        require(gauges[IStakerVault(stakerVault).getLpGauge()], Error.GAUGE_DOES_NOT_EXIST);
        _ensurePoolExists(lpToken);
        bytes32 key = _getLpStakerVaultKey(stakerVault);
        _prepare(key, newPoolWeight);
        return true;
    }

    /**
     * @notice Execute update of lp pool weight (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New lp pool weight.
     */
    function executeLpPoolWeight(address lpToken) external override returns (uint256) {
        address stakerVault = addressProvider.getStakerVault(lpToken);
        // Require both that gauge is registered and that pool is still in action
        require(IStakerVault(stakerVault).getLpGauge() != address(0), Error.ADDRESS_NOT_FOUND);
        _ensurePoolExists(lpToken);
        bytes32 key = _getLpStakerVaultKey(stakerVault);
        _executeLpPoolWeight(key, lpToken, stakerVault, isInflationWeightManager(msg.sender));
        return currentUInts256[key];
    }

    /**
     * @notice Prepare update of a batch of LP token weights (with time delay enforced).
     * @dev Each entry in the lpTokens array corresponds to an entry in the weights array.
     * @param lpTokens LpTokens to update the inflation weight for.
     * @param weights New weights for the inflation for the LpTokens.
     * @return `true` if successful.
     */
    function batchPrepareLpPoolWeights(address[] calldata lpTokens, uint256[] calldata weights)
        external
        override
        onlyRoles2(Roles.GOVERNANCE, Roles.INFLATION_MANAGER)
        returns (bool)
    {
        uint256 length = lpTokens.length;
        require(length == weights.length, "Invalid length of arguments");
        bytes32 key;
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            address stakerVault = addressProvider.getStakerVault(lpTokens[i]);
            // Require both that gauge is registered and that pool is still in action
            require(IStakerVault(stakerVault).getLpGauge() != address(0), Error.ADDRESS_NOT_FOUND);
            _ensurePoolExists(lpTokens[i]);
            key = _getLpStakerVaultKey(stakerVault);
            _prepare(key, weights[i]);
        }
        return true;
    }

    /**
     * @notice Execute weight updates for a batch of LpTokens.
     * @dev If this is called by the INFLATION_MANAGER role address, no time delay is enforced.
     * @param lpTokens LpTokens to execute the weight updates for.
     * @return `true` if successful.
     */
    function batchExecuteLpPoolWeights(address[] calldata lpTokens)
        external
        override
        onlyRoles2(Roles.GOVERNANCE, Roles.INFLATION_MANAGER)
        returns (bool)
    {
        uint256 length = lpTokens.length;
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            address lpToken = lpTokens[i];
            address stakerVault = addressProvider.getStakerVault(lpToken);
            // Require both that gauge is registered and that pool is still in action
            require(IStakerVault(stakerVault).getLpGauge() != address(0), Error.ADDRESS_NOT_FOUND);
            _ensurePoolExists(lpToken);
            bytes32 key = _getLpStakerVaultKey(stakerVault);
            _executeLpPoolWeight(key, lpToken, stakerVault, isInflationWeightManager(msg.sender));
        }
        return true;
    }

    /**
     * @notice Prepare an inflation weight update for an AMM token (with time delay enforced).
     * @param token AMM token to update the weight for.
     * @param newTokenWeight New AMM token inflation weight.
     * @return `true` if successful.
     */
    function prepareAmmTokenWeight(address token, uint256 newTokenWeight)
        external
        override
        onlyRoles2(Roles.GOVERNANCE, Roles.INFLATION_MANAGER)
        returns (bool)
    {
        require(_ammGauges.contains(token), "amm gauge not found");
        bytes32 key = _getAmmGaugeKey(token);
        _prepare(key, newTokenWeight);
        return true;
    }

    /**
     * @notice Execute update of lp pool weight (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New lp pool weight.
     */
    function executeAmmTokenWeight(address token) external override returns (uint256) {
        bytes32 key = _getAmmGaugeKey(token);
        _executeAmmTokenWeight(token, key, isInflationWeightManager(msg.sender));
        return currentUInts256[key];
    }

    /**
     * @notice Registers a pool's strategy with the stakerVault of the pool where the strategy deposits.
     * @dev This simply avoids the strategy accumulating tokens in the deposit pool.
     * @param depositStakerVault StakerVault of the pool where the strategy deposits.
     * @param strategyPool The pool of the strategy to register (avoids blacklisting other addresses).
     * @return `true` if successful.
     */
    function addStrategyToDepositStakerVault(address depositStakerVault, address strategyPool)
        external
        override
        onlyGovernance
        returns (bool)
    {
        IVault _vault = ILiquidityPool(strategyPool).getVault();
        IStakerVault(depositStakerVault).addStrategy(address(_vault.getStrategy()));
        return true;
    }

    /**
     * @notice Prepare update of a batch of AMM token weights (with time delay enforced).
     * @dev Each entry in the tokens array corresponds to an entry in the weights array.
     * @param tokens AMM tokens to update the inflation weight for.
     * @param weights New weights for the inflation for the AMM tokens.
     * @return `true` if successful.
     */
    function batchPrepareAmmTokenWeights(address[] calldata tokens, uint256[] calldata weights)
        external
        override
        onlyRoles2(Roles.GOVERNANCE, Roles.INFLATION_MANAGER)
        returns (bool)
    {
        uint256 length = tokens.length;
        bytes32 key;
        require(length == weights.length, "Invalid length of arguments");
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            require(_ammGauges.contains(tokens[i]), "amm gauge not found");
            key = _getAmmGaugeKey(tokens[i]);
            _prepare(key, weights[i]);
        }
        return true;
    }

    /**
     * @notice Execute weight updates for a batch of AMM tokens.
     * @dev If this is called by the INFLATION_MANAGER role address, no time delay is enforced.
     * @param tokens AMM tokens to execute the weight updates for.
     * @return `true` if successful.
     */
    function batchExecuteAmmTokenWeights(address[] calldata tokens)
        external
        override
        onlyRoles2(Roles.GOVERNANCE, Roles.INFLATION_MANAGER)
        returns (bool)
    {
        uint256 length = tokens.length;
        bool isWeightManager = isInflationWeightManager(msg.sender);
        bytes32 key;
        address token;
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            token = tokens[i];
            key = _getAmmGaugeKey(token);
            _executeAmmTokenWeight(token, key, isWeightManager);
        }
        return true;
    }

    /**
     * @notice Sets the KeeperGauge for a pool.
     * @dev Multiple pools can have the same KeeperGauge.
     * @param pool Address of pool to set the KeeperGauge for.
     * @param _keeperGauge Address of KeeperGauge.
     * @return `true` if successful.
     */
    function setKeeperGauge(address pool, address _keeperGauge)
        external
        override
        onlyGovernance
        returns (bool)
    {
        uint256 length = _keeperGauges.length();
        bool keeperGaugeExists = false;
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            if (address(_keeperGauges.valueAt(i)) == _keeperGauge) {
                keeperGaugeExists = true;
                break;
            }
        }
        // Check to make sure that once weight-based dist is deactivated, only one gauge can exist
        if (!keeperGaugeExists && weightBasedKeeperDistributionDeactivated && length >= 1) {
            return false;
        }
        (bool exists, address keeperGauge) = _keeperGauges.tryGet(pool);
        require(!exists || keeperGauge != _keeperGauge, Error.INVALID_ARGUMENT);

        if (exists && !IKeeperGauge(keeperGauge).killed()) {
            IKeeperGauge(keeperGauge).poolCheckpoint();
            IKeeperGauge(keeperGauge).kill();
        }
        _keeperGauges.set(pool, _keeperGauge);
        gauges[_keeperGauge] = true;
        return true;
    }

    function removeKeeperGauge(address pool) external onlyGovernance returns (bool) {
        _removeKeeperGauge(pool);
        return true;
    }

    /**
     * @notice Sets the AmmGauge for a particular AMM token.
     * @param token Address of the amm token.
     * @param _ammGauge Address of AmmGauge.
     * @return `true` if successful.
     */
    function setAmmGauge(address token, address _ammGauge)
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(IAmmGauge(_ammGauge).isAmmToken(token), Error.ADDRESS_NOT_WHITELISTED);
        uint256 length = _ammGauges.length();
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            if (address(_ammGauges.valueAt(i)) == _ammGauge) {
                return false;
            }
        }
        if (_ammGauges.contains(token)) {
            address ammGauge = _ammGauges.get(token);
            IAmmGauge(ammGauge).poolCheckpoint();
            IAmmGauge(ammGauge).kill();
        }
        _ammGauges.set(token, _ammGauge);
        gauges[_ammGauge] = true;
        return true;
    }

    function removeAmmGauge(address token) external override onlyGovernance returns (bool) {
        if (!_ammGauges.contains(token)) return false;
        address ammGauge = _ammGauges.get(token);
        bytes32 key = _getAmmGaugeKey(token);
        _prepare(key, 0);
        _executeAmmTokenWeight(token, key, true);
        IAmmGauge(ammGauge).kill();
        _ammGauges.remove(token);
        // Do not delete from the gauges map to allow claiming of remaining balances
        emit AmmGaugeDelisted(token, ammGauge);
        return true;
    }

    function addGaugeForVault(address lpToken) external override returns (bool) {
        IStakerVault _stakerVault = IStakerVault(msg.sender);
        require(addressProvider.isStakerVault(msg.sender, lpToken), Error.UNAUTHORIZED_ACCESS);
        address lpGauge = _stakerVault.getLpGauge();
        require(lpGauge != address(0), Error.GAUGE_DOES_NOT_EXIST);
        gauges[lpGauge] = true;
        return true;
    }

    function getAllAmmGauges() external view override returns (address[] memory) {
        return _ammGauges.valuesArray();
    }

    function getLpRateForStakerVault(address stakerVault) external view override returns (uint256) {
        if (minter == address(0) || totalLpPoolWeight == 0) {
            return 0;
        }

        bytes32 key = _getLpStakerVaultKey(stakerVault);
        uint256 lpInflationRate = Minter(minter).getLpInflationRate();
        uint256 poolInflationRate = (currentUInts256[key] * lpInflationRate) / totalLpPoolWeight;

        return poolInflationRate;
    }

    function getKeeperRateForPool(address pool) external view override returns (uint256) {
        if (minter == address(0)) {
            return 0;
        }
        uint256 keeperInflationRate = Minter(minter).getKeeperInflationRate();
        // After deactivation of weight based dist, KeeperGauge handles the splitting
        if (weightBasedKeeperDistributionDeactivated) return keeperInflationRate;
        if (totalKeeperPoolWeight == 0) return 0;
        bytes32 key = _getKeeperGaugeKey(pool);
        uint256 poolInflationRate = (currentUInts256[key] * keeperInflationRate) /
            totalKeeperPoolWeight;
        return poolInflationRate;
    }

    function getAmmRateForToken(address token) external view override returns (uint256) {
        if (minter == address(0) || totalAmmTokenWeight == 0) {
            return 0;
        }
        bytes32 key = _getAmmGaugeKey(token);
        uint256 ammInflationRate = Minter(minter).getAmmInflationRate();
        uint256 ammTokenInflationRate = (currentUInts256[key] * ammInflationRate) /
            totalAmmTokenWeight;
        return ammTokenInflationRate;
    }

    //TOOD: See if this is still needed somewhere
    function getKeeperWeightForPool(address pool) external view override returns (uint256) {
        bytes32 key = _getKeeperGaugeKey(pool);
        return currentUInts256[key];
    }

    function getAmmWeightForToken(address token) external view override returns (uint256) {
        bytes32 key = _getAmmGaugeKey(token);
        return currentUInts256[key];
    }

    function getLpPoolWeight(address lpToken) external view override returns (uint256) {
        address stakerVault = addressProvider.getStakerVault(lpToken);
        bytes32 key = _getLpStakerVaultKey(stakerVault);
        return currentUInts256[key];
    }

    function getKeeperGaugeForPool(address pool) external view override returns (address) {
        (, address keeperGauge) = _keeperGauges.tryGet(pool);
        return keeperGauge;
    }

    function getAmmGaugeForToken(address token) external view override returns (address) {
        (, address ammGauge) = _ammGauges.tryGet(token);
        return ammGauge;
    }

    /**
     * @notice Check if an account is governance proxy.
     * @param account Address to check.
     * @return `true` if account is governance proxy.
     */
    function isInflationWeightManager(address account) public view override returns (bool) {
        return _roleManager().hasRole(Roles.INFLATION_MANAGER, account);
    }

    function _executeKeeperPoolWeight(
        bytes32 key,
        address pool,
        bool isWeightManager
    ) internal returns (bool) {
        IKeeperGauge(_keeperGauges.get(pool)).poolCheckpoint();
        totalKeeperPoolWeight = totalKeeperPoolWeight - currentUInts256[key] + pendingUInts256[key];
        totalKeeperPoolWeight = totalKeeperPoolWeight > 0 ? totalKeeperPoolWeight : 0;
        isWeightManager ? _setConfig(key, pendingUInts256[key]) : _executeUInt256(key);
        emit NewKeeperWeight(pool, currentUInts256[key]);
        return true;
    }

    function _executeLpPoolWeight(
        bytes32 key,
        address lpToken,
        address stakerVault,
        bool isWeightManager
    ) internal returns (bool) {
        IStakerVault(stakerVault).poolCheckpoint();
        totalLpPoolWeight = totalLpPoolWeight - currentUInts256[key] + pendingUInts256[key];
        totalLpPoolWeight = totalLpPoolWeight > 0 ? totalLpPoolWeight : 0;
        isWeightManager ? _setConfig(key, pendingUInts256[key]) : _executeUInt256(key);
        emit NewLpWeight(lpToken, currentUInts256[key]);
        return true;
    }

    function _executeAmmTokenWeight(
        address token,
        bytes32 key,
        bool isWeightManager
    ) internal returns (bool) {
        IAmmGauge(_ammGauges.get(token)).poolCheckpoint();
        totalAmmTokenWeight = totalAmmTokenWeight - currentUInts256[key] + pendingUInts256[key];
        totalAmmTokenWeight = totalAmmTokenWeight > 0 ? totalAmmTokenWeight : 0;
        isWeightManager ? _setConfig(key, pendingUInts256[key]) : _executeUInt256(key);
        // Do pool checkpoint to update the pool integrals
        emit NewAmmTokenWeight(token, currentUInts256[key]);
        return true;
    }

    function _removeKeeperGauge(address pool) internal {
        address keeperGauge = _keeperGauges.get(pool);
        bytes32 key = _getKeeperGaugeKey(pool);
        _prepare(key, 0);
        _executeKeeperPoolWeight(key, pool, true);
        _keeperGauges.remove(pool);
        IKeeperGauge(keeperGauge).kill();
        // Do not delete from the gauges map to allow claiming of remaining balances
        emit KeeperGaugeDelisted(pool, keeperGauge);
    }

    function _ensurePoolExists(address lpToken) internal view {
        require(
            address(addressProvider.safeGetPoolForToken(lpToken)) != address(0),
            Error.ADDRESS_NOT_FOUND
        );
    }

    function _getKeeperGaugeKey(address pool) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_KEEPER_WEIGHT_KEY, pool));
    }

    function _getAmmGaugeKey(address token) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_AMM_WEIGHT_KEY, token));
    }

    function _getLpStakerVaultKey(address vault) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_LP_WEIGHT_KEY, vault));
    }
}
