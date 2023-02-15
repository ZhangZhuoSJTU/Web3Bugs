// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "./VaderPool.sol";

import "../../shared/ProtocolConstants.sol";

import "../../interfaces/shared/IERC20Extended.sol";
import "../../interfaces/dex/pool/IVaderPoolFactory.sol";

/*
 * @dev Implementation of {VaderPoolFactory} contract.
 *
 * The VaderPoolFactory contract inherits from {Ownable} and {ProtocolConstants} contracts.
 *
 * Keeps track of all the created Vader pools through {getPool} mapping and
 * {allPools} array. Also stores the address of asset used as native asset
 * across all of the Vader pools created through the factory.
 *
 * Allows creation of new Vader pools.
 **/
contract VaderPoolFactory is IVaderPoolFactory, ProtocolConstants, Ownable {
    /* ========== STATE VARIABLES ========== */

    // Denotes whether the queue system is active on new pairs, disabled by default
    bool public queueActive;

    // Native Asset of the system
    address public override nativeAsset;

    // Token A -> Token B -> Pool mapping
    mapping(address => mapping(address => IVaderPool)) public override getPool;

    // A list of all pools
    IVaderPool[] public allPools;

    /* ========== VIEWS ========== */

    /* ========== MUTATIVE FUNCTIONS ========== */

    /*
     * @dev Allows creation of a Vader pool of native and foreign assets.
     *
     * Populates the {getPool} mapping with the newly created Vader pool and
     * pushes this pool to {allPools} array.
     *
     * Requirements:
     * - Native and foreign assets cannot be the same.
     * - Foreign asset cannot be the zero address.
     * - The pool against the specified foreign asset does not already exist.
     **/
    // NOTE: Between deployment & initialization may be corrupted but chance small
    function createPool(address tokenA, address tokenB)
        external
        override
        returns (IVaderPool pool)
    {
        (address token0, address token1) = tokenA == nativeAsset
            ? (tokenA, tokenB)
            : tokenB == nativeAsset
            ? (tokenB, tokenA)
            : (_ZERO_ADDRESS, _ZERO_ADDRESS);

        require(
            token0 != token1,
            "VaderPoolFactory::createPool: Identical Tokens"
        );

        require(
            token1 != _ZERO_ADDRESS,
            "VaderPoolFactory::createPool: Inexistent Token"
        );

        require(
            getPool[token0][token1] == IVaderPool(_ZERO_ADDRESS),
            "VaderPoolFactory::createPool: Pair Exists"
        ); // single check is sufficient

        pool = new VaderPool(
            queueActive,
            IERC20Extended(token0),
            IERC20Extended(token1)
        );
        getPool[token0][token1] = pool;
        getPool[token1][token0] = pool; // populate mapping in the reverse direction
        allPools.push(pool);
        emit PoolCreated(token0, token1, pool, allPools.length);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /*
     * @dev Allows initializing of the factory contract by owner by setting the
     * address of native asset for all the Vader pool and also transferring the
     * contract's ownership to {_dao}.
     *
     * Requirements:
     * - Only onwer can call this function.
     **/
    function initialize(address _nativeAsset, address _dao) external onlyOwner {
        require(
            _nativeAsset != _ZERO_ADDRESS && _dao != _ZERO_ADDRESS,
            "VaderPoolFactory::initialize: Incorrect Arguments"
        );

        nativeAsset = _nativeAsset;
        transferOwnership(_dao);
    }

    /*
     * @dev Allows toggling of queue system of a pool.
     *
     * Requirements:
     * - This function can only be called when DAO is active.
     **/
    function toggleQueue(address token0, address token1) external onlyDAO {
        getPool[token0][token1].toggleQueue();
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== PRIVATE FUNCTIONS ========== */

    /**
     * @dev Ensures only the DAO is able to invoke a particular function by validating that
     * the owner is the msg.sender, equivalent to the DAO address, and that the native asset
     * has been set
     */
    function _onlyDAO() private view {
        require(
            nativeAsset != _ZERO_ADDRESS && owner() == _msgSender(),
            "BasePool::_onlyDAO: Insufficient Privileges"
        );
    }

    /* ========== MODIFIERS ========== */

    /**
     * @dev Throws if invoked by anyone else other than the DAO
     */
    modifier onlyDAO() {
        _onlyDAO();
        _;
    }
}
