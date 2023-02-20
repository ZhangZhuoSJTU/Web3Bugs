// SPDX-License-Identifier: BUSL-1.1
pragma solidity >= 0.8.0;

import "../interfaces/yieldspace/IPoolFactory.sol";
import "./Pool.sol";


/// @dev The PoolFactory can deterministically create new pool instances.
contract PoolFactory is IPoolFactory {
  /// Pre-hashing the bytecode allows calculatePoolAddress to be cheaper, and
  /// makes client-side address calculation easier
  bytes32 public constant override POOL_BYTECODE_HASH = keccak256(type(Pool).creationCode);

  address private _nextBase;
  address private _nextFYToken;

  /// @dev Returns true if `account` is a contract.
  function isContract(address account) internal view returns (bool) {
      // This method relies on extcodesize, which returns 0 for contracts in
      // construction, since the code is only stored at the end of the
      // constructor execution.

      uint256 size;
      // solhint-disable-next-line no-inline-assembly
      assembly { size := extcodesize(account) }
      return size > 0;
  }

  /// @dev Calculate the deterministic addreess of a pool, based on the base token & fy token.
  /// @param base Address of the base token (such as Base).
  /// @param fyToken Address of the fixed yield token (such as fyToken).
  /// @return The calculated pool address.
  function calculatePoolAddress(address base, address fyToken) external view override returns (address) {
    return _calculatePoolAddress(base, fyToken);
  }

  /// @dev Create2 calculation
  function _calculatePoolAddress(address base, address fyToken)
    private view returns (address calculatedAddress)
  {
    calculatedAddress = address(uint160(uint256(keccak256(abi.encodePacked(
      bytes1(0xff),
      address(this),
      keccak256(abi.encodePacked(base, fyToken)),
      POOL_BYTECODE_HASH
    )))));
  }

  /// @dev Calculate the addreess of a pool, and return address(0) if not deployed.
  /// @param base Address of the base token (such as Base).
  /// @param fyToken Address of the fixed yield token (such as fyToken).
  /// @return pool The deployed pool address.
  function getPool(address base, address fyToken) external view override returns (address pool) {
    pool = _calculatePoolAddress(base, fyToken);

    if(!isContract(pool)) {
      pool = address(0);
    }
  }

  /// @dev Deploys a new pool.
  /// base & fyToken are written to temporary storage slots to allow for simpler
  /// address calculation, while still allowing the Pool contract to store the values as
  /// immutable.
  /// @param base Address of the base token (such as Base).
  /// @param fyToken Address of the fixed yield token (such as fyToken).
  /// @return pool The pool address.
  function createPool(address base, address fyToken) external override returns (address) {
    _nextBase = base;
    _nextFYToken = fyToken;
    Pool pool = new Pool{salt: keccak256(abi.encodePacked(base, fyToken))}();
    _nextBase = address(0);
    _nextFYToken = address(0);

    pool.transferOwnership(msg.sender);
    
    emit PoolCreated(base, fyToken, address(pool));

    return address(pool);
  }

  /// @dev Only used by the Pool constructor.
  /// @return The base token for the currently-constructing pool.
  function nextBase() external view override returns (address) {
    return _nextBase;
  }

  /// @dev Only used by the Pool constructor.
  /// @return The fytoken for the currently-constructing pool.
  function nextFYToken() external view override returns (address) {
    return _nextFYToken;
  }
}
