// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "../../interfaces/IStakerVault.sol";
import "../../interfaces/IVault.sol";
import "../../interfaces/ILpToken.sol";
import "../../interfaces/IAdmin.sol";
import "../../interfaces/IController.sol";
import "../../interfaces/pool/ILiquidityPool.sol";
import "../../interfaces/pool/IErc20Pool.sol";
import "../../interfaces/pool/IEthPool.sol";
import "../../interfaces/pool/IPoolFactory.sol";

import "../../libraries/ScaledMath.sol";
import "../../libraries/AddressProviderHelpers.sol";

import "../access/Authorization.sol";

contract PoolFactory is IPoolFactory, Authorization {
    using AddressProviderHelpers for IAddressProvider;

    bytes32 internal constant _POOL_KEY = "pool";
    bytes32 internal constant _LP_TOKEN_KEY = "lp_token";
    bytes32 internal constant _STAKER_VAULT_KEY = "staker_vault";
    bytes32 internal constant _VAULT_KEY = "vault";

    IController public immutable controller;
    IAddressProvider public immutable addressProvider;

    /**
     * @dev maps a contract type (e.g. "pool" or "lp_token", as defined in constants above)
     * to a mapping from an implementation name to the actual implementation
     * The implementation name is decided when registering the implementation
     * and can be arbitrary (e.g. "ERC20PoolV1")
     */
    mapping(bytes32 => mapping(bytes32 => address)) public implementations;

    event NewPool(address pool, address vault, address lpToken, address stakerVault);
    event NewImplementation(bytes32 key, bytes32 name, address implementation);

    constructor(IController _controller)
        Authorization(_controller.addressProvider().getRoleManager())
    {
        controller = IController(_controller);
        addressProvider = IController(_controller).addressProvider();
    }

    /**
     * @notice Add a new pool implementation to the factory.
     * @param name of the pool implementation.
     * @param implementation of pool implementation to add.
     */
    function addPoolImplementation(bytes32 name, address implementation)
        external
        override
        onlyGovernance
        returns (bool)
    {
        return _addImplementation(_POOL_KEY, name, implementation);
    }

    /**
     * @notice Add a new LP token implementation to the factory.
     * @param name of the LP token implementation.
     * @param implementation of lp token implementation to add.
     */
    function addLpTokenImplementation(bytes32 name, address implementation)
        external
        override
        onlyGovernance
        returns (bool)
    {
        return _addImplementation(_LP_TOKEN_KEY, name, implementation);
    }

    /**
     * @notice Add a new vault implementation to the factory.
     * @param name of the vault implementation.
     * @param implementation of vault implementation to add.
     */
    function addVaultImplementation(bytes32 name, address implementation)
        external
        override
        onlyGovernance
        returns (bool)
    {
        return _addImplementation(_VAULT_KEY, name, implementation);
    }

    /**
     * @notice Add a new staker vault implementation to the factory.
     * @param name of the staker vault implementation.
     * @param implementation of staker vault implementation to add.
     */
    function addStakerVaultImplementation(bytes32 name, address implementation)
        external
        override
        onlyGovernance
        returns (bool)
    {
        return _addImplementation(_STAKER_VAULT_KEY, name, implementation);
    }

    /**
     * @notice Deploys a new pool and LP token.
     * @dev Decimals is an argument as not all ERC20 tokens implement the ERC20Detailed interface.
     *      An implementation where `getUnderlying()` returns the zero address is for ETH pools.
     * @param poolName Name of the pool.
     * @param underlying Address of the pool's underlying.
     * @param lpTokenArgs Arguments to create the LP token for the pool
     * @param vaultArgs Arguments to create the vault
     * @param implementationNames Name of the implementations to use
     * @return addrs Address of the deployed pool, address of the pool's deployed LP token.
     */
    function deployPool(
        string calldata poolName,
        address underlying,
        LpTokenArgs calldata lpTokenArgs,
        VaultArgs calldata vaultArgs,
        ImplementationNames calldata implementationNames
    ) external override onlyGovernance returns (Addresses memory addrs) {
        DeployPoolVars memory vars;

        vars.poolImplementation = implementations[_POOL_KEY][implementationNames.pool];
        require(vars.poolImplementation != address(0), Error.INVALID_POOL_IMPLEMENTATION);

        vars.lpTokenImplementation = implementations[_LP_TOKEN_KEY][implementationNames.lpToken];
        require(vars.lpTokenImplementation != address(0), Error.INVALID_LP_TOKEN_IMPLEMENTATION);

        vars.vaultImplementation = implementations[_VAULT_KEY][implementationNames.vault];
        require(vars.vaultImplementation != address(0), Error.INVALID_VAULT_IMPLEMENTATION);

        vars.stakerVaultImplementation = implementations[_STAKER_VAULT_KEY][
            implementationNames.stakerVault
        ];
        require(
            vars.stakerVaultImplementation != address(0),
            Error.INVALID_STAKER_VAULT_IMPLEMENTATION
        );

        addrs.pool = Clones.clone(vars.poolImplementation);
        addrs.vault = Clones.clone(vars.vaultImplementation);

        if (underlying == address(0)) {
            // ETH pool
            require(
                ILiquidityPool(vars.poolImplementation).getUnderlying() == address(0),
                Error.INVALID_POOL_IMPLEMENTATION
            );
            require(lpTokenArgs.decimals == 18, Error.INVALID_DECIMALS);
            IEthPool(addrs.pool).initialize(poolName, addrs.vault);
        } else {
            IErc20Pool(addrs.pool).initialize(poolName, underlying, addrs.vault);
        }

        addrs.lpToken = Clones.clone(vars.lpTokenImplementation);

        ILpToken(addrs.lpToken).initialize(
            lpTokenArgs.name,
            lpTokenArgs.symbol,
            lpTokenArgs.decimals,
            addrs.pool
        );

        addrs.stakerVault = Clones.clone(vars.stakerVaultImplementation);
        IStakerVault(addrs.stakerVault).initialize(addrs.lpToken);
        controller.addStakerVault(addrs.stakerVault);

        ILiquidityPool(addrs.pool).setLpToken(addrs.lpToken);
        ILiquidityPool(addrs.pool).setStaker();

        IVault(addrs.vault).initialize(
            addrs.pool,
            vaultArgs.debtLimit,
            vaultArgs.targetAllocation,
            vaultArgs.bound
        );

        addressProvider.addPool(addrs.pool);

        emit NewPool(addrs.pool, addrs.vault, addrs.lpToken, addrs.stakerVault);
        return addrs;
    }

    /**
     * @notice Add a new implementation of type `name` to the factory.
     * @param key of the implementation to add.
     * @param name of the implementation to add.
     * @param implementation of lp token implementation to add.
     */
    function _addImplementation(
        bytes32 key,
        bytes32 name,
        address implementation
    ) internal returns (bool) {
        mapping(bytes32 => address) storage currentImplementations = implementations[key];
        if (currentImplementations[name] != address(0)) {
            return false;
        }
        currentImplementations[name] = implementation;
        emit NewImplementation(key, name, implementation);
        return true;
    }
}
