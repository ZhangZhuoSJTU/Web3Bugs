// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/**
 * @title Library that handles locked balances efficiently using bit packing.
 */
library LockedBalance {
  /// @dev Tracks an account's total lockup per expiration time.
  struct Lockup {
    uint32 expiration;
    uint96 totalAmount;
  }

  struct Lockups {
    /// @dev Mapping from key to lockups.
    /// i) A key represents 2 lockups. The key for a lockup is `index / 2`.
    ///     For instance, elements with index 25 and 24 would map to the same key.
    /// ii) The `value` for the `key` is split into two 128bits which are used to store the metadata for a lockup.
    mapping(uint256 => uint256) lockups;
  }

  // Masks used to split a uint256 into two equal pieces which represent two individual Lockups.
  uint256 private constant last128BitsMask = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
  uint256 private constant first128BitsMask = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000000000000000000000000000;

  // Masks used to retrieve or set the totalAmount value of a single Lockup.
  uint256 private constant firstAmountBitsMask = 0xFFFFFFFF000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
  uint256 private constant secondAmountBitsMask = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000000;

  /**
   * @notice Clears the lockup at the index.
   */
  function del(Lockups storage lockups, uint256 index) internal {
    unchecked {
      if (index % 2 == 0) {
        index /= 2;
        lockups.lockups[index] = (lockups.lockups[index] & last128BitsMask);
      } else {
        index /= 2;
        lockups.lockups[index] = (lockups.lockups[index] & first128BitsMask);
      }
    }
  }

  /**
   * @notice Sets the Lockup at the provided index.
   */
  function set(
    Lockups storage lockups,
    uint256 index,
    uint256 expiration,
    uint256 totalAmount
  ) internal {
    unchecked {
      uint256 lockedBalanceBits = totalAmount | (expiration << 96);
      if (index % 2 == 0) {
        // set first 128 bits.
        index /= 2;
        lockups.lockups[index] = (lockups.lockups[index] & last128BitsMask) | (lockedBalanceBits << 128);
      } else {
        // set last 128 bits.
        index /= 2;
        lockups.lockups[index] = (lockups.lockups[index] & first128BitsMask) | lockedBalanceBits;
      }
    }
  }

  /**
   * @notice Sets only the totalAmount for a lockup at the index.
   */
  function setTotalAmount(
    Lockups storage lockups,
    uint256 index,
    uint256 totalAmount
  ) internal {
    unchecked {
      if (index % 2 == 0) {
        index /= 2;
        lockups.lockups[index] = (lockups.lockups[index] & firstAmountBitsMask) | (totalAmount << 128);
      } else {
        index /= 2;
        lockups.lockups[index] = (lockups.lockups[index] & secondAmountBitsMask) | totalAmount;
      }
    }
  }

  /**
   * @notice Returns the Lockup at the provided index.
   * @dev To get the lockup stored in the *first* 128 bits (first slot/lockup):
   *       - we remove the last 128 bits (done by >> 128)
   *      To get the lockup stored in the *last* 128 bits (second slot/lockup):
   *       - we take the last 128 bits (done by % (2**128))
   *      Once the lockup is obtained:
   *       - get `expiration` by peaking at the first 32 bits (done by >> 96)
   *       - get `totalAmount` by peaking at the last 96 bits (done by % (2**96))
   */
  function get(Lockups storage lockups, uint256 index) internal view returns (Lockup memory balance) {
    unchecked {
      uint256 lockupMetadata = lockups.lockups[index / 2];
      if (lockupMetadata == 0) {
        return balance;
      }
      uint128 lockedBalanceBits;
      if (index % 2 == 0) {
        // use first 128 bits.
        lockedBalanceBits = uint128(lockupMetadata >> 128);
      } else {
        // use last 128 bits.
        lockedBalanceBits = uint128(lockupMetadata % (2**128));
      }
      // unpack the bits to retrieve the Lockup.
      balance.expiration = uint32(lockedBalanceBits >> 96);
      balance.totalAmount = uint96(lockedBalanceBits % (2**96));
    }
  }
}
