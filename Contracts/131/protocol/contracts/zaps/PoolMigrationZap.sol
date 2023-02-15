// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/zaps/IPoolMigrationZap.sol";
import "../../interfaces/IAddressProvider.sol";
import "../../interfaces/pool/ILiquidityPool.sol";

/**
 * This is a Zap contract to assist in the migration from the V1 Backd Pools to the new Backd Pools.
 */
contract PoolMigrationZap is IPoolMigrationZap {
    using SafeERC20 for IERC20;

    mapping(address => ILiquidityPool) internal _underlyingNewPools; // A mapping from underlyings to new pools

    event Migrated(address user, address oldPool, address newPool, uint256 lpTokenAmount); // Emitted when a migration is completed

    constructor(address newAddressProviderAddress_) {
        address[] memory newPools_ = IAddressProvider(newAddressProviderAddress_).allPools();
        for (uint256 i; i < newPools_.length; ++i) {
            ILiquidityPool newPool_ = ILiquidityPool(newPools_[i]);
            address underlying_ = newPool_.getUnderlying();
            _underlyingNewPools[underlying_] = newPool_;
            if (underlying_ == address(0)) continue;
            IERC20(underlying_).safeApprove(address(newPool_), type(uint256).max);
        }
    }

    receive() external payable {}

    /**
     * @notice Migrates all of a users balance from the old pools to the new pools.
     * @dev The user must have balance in all pools given, otherwise transaction will revert.
     * @param oldPoolAddresses_ The list of old pools to migrate for the user.
     */
    function migrateAll(address[] calldata oldPoolAddresses_) external override {
        for (uint256 i; i < oldPoolAddresses_.length; ) {
            migrate(oldPoolAddresses_[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Migrates a users balance from an old pool to a new pool.
     * @dev The user must have balance in the pool given, otherwise transaction will revert.
     * @param oldPoolAddress_ The old pool to migrate for the user.
     */
    function migrate(address oldPoolAddress_) public override {
        ILiquidityPool oldPool_ = ILiquidityPool(oldPoolAddress_);
        IERC20 lpToken_ = IERC20(oldPool_.getLpToken());
        uint256 lpTokenAmount_ = lpToken_.balanceOf(msg.sender);
        require(lpTokenAmount_ != 0, "No LP Tokens");
        require(oldPool_.getWithdrawalFee(msg.sender, lpTokenAmount_) == 0, "withdrawal fee not 0");
        lpToken_.safeTransferFrom(msg.sender, address(this), lpTokenAmount_);
        uint256 underlyingAmount_ = oldPool_.redeem(lpTokenAmount_);
        address underlying_ = oldPool_.getUnderlying();
        ILiquidityPool newPool_ = _underlyingNewPools[underlying_];
        uint256 ethValue_ = underlying_ == address(0) ? underlyingAmount_ : 0;
        newPool_.depositFor{value: ethValue_}(msg.sender, underlyingAmount_);
        emit Migrated(msg.sender, address(oldPool_), address(newPool_), lpTokenAmount_);
    }
}
