// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;
import "./interfaces/vault/ICauldron.sol";
import "./interfaces/vault/IJoin.sol";
import "./interfaces/yieldspace/IPool.sol";


/// @dev Ladle orchestrates contract calls throughout the Yield Protocol v2 into useful and efficient user oriented features.
contract LadleStorage {

    enum Operation {
        BUILD,               // 0
        TWEAK,               // 1
        GIVE,                // 2
        DESTROY,             // 3
        STIR,                // 4
        POUR,                // 5
        SERVE,               // 6
        ROLL,                // 7
        CLOSE,               // 8
        REPAY,               // 9
        REPAY_VAULT,         // 10
        REPAY_LADLE,         // 11
        RETRIEVE,            // 12
        FORWARD_PERMIT,      // 13
        FORWARD_DAI_PERMIT,  // 14
        JOIN_ETHER,          // 15
        EXIT_ETHER,          // 16
        TRANSFER_TO_POOL,    // 17
        ROUTE,               // 18
        TRANSFER_TO_FYTOKEN, // 19
        REDEEM,              // 20
        MODULE               // 21
    }

    ICauldron public immutable cauldron;
    uint256 public borrowingFee;

    mapping (bytes6 => IJoin)                   public joins;            // Join contracts available to manage assets. The same Join can serve multiple assets (ETH-A, ETH-B, etc...)
    mapping (bytes6 => IPool)                   public pools;            // Pool contracts available to manage series. 12 bytes still free.
    mapping (address => bool)                   public modules;          // Trusted contracts to execute anything on.

    event JoinAdded(bytes6 indexed assetId, address indexed join);
    event PoolAdded(bytes6 indexed seriesId, address indexed pool);
    event ModuleSet(address indexed module, bool indexed set);
    event FeeSet(uint256 fee);

    constructor (ICauldron cauldron_) {
        cauldron = cauldron_;
    }
}