// SPDX-License-Identifier: BUSL-1.1
pragma solidity >= 0.8.0;

import "./interfaces/vault/IJoinFactory.sol";
import "./Join.sol";


/// @dev The JoinFactory can deterministically create new join instances.
contract JoinFactory is IJoinFactory {
  /// Pre-hashing the bytecode allows calculateJoinAddress to be cheaper, and
  /// makes client-side address calculation easier
  bytes32 public constant override JOIN_BYTECODE_HASH = keccak256(type(Join).creationCode);

  address private _nextAsset;

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

  /// @dev Calculate the deterministic addreess of a join, based on the asset token.
  /// @param asset Address of the asset token.
  /// @return The calculated join address.
  function calculateJoinAddress(address asset) external view override returns (address) {
    return _calculateJoinAddress(asset);
  }

  /// @dev Create2 calculation
  function _calculateJoinAddress(address asset)
    private view returns (address calculatedAddress)
  {
    calculatedAddress = address(uint160(uint256(keccak256(abi.encodePacked(
      bytes1(0xff),
      address(this),
      keccak256(abi.encodePacked(asset)),
      JOIN_BYTECODE_HASH
    )))));
  }

  /// @dev Calculate the address of a join, and return address(0) if not deployed.
  /// @param asset Address of the asset token.
  /// @return join The deployed join address.
  function getJoin(address asset) external view override returns (address join) {
    join = _calculateJoinAddress(asset);

    if(!isContract(join)) {
      join = address(0);
    }
  }

  /// @dev Deploys a new join.
  /// The asset address is written to a temporary storage slot to allow for simpler
  /// address calculation, while still allowing the Join contract to store the values as
  /// immutable.
  /// @param asset Address of the asset token.
  /// @return join The join address.
  function createJoin(address asset) external override returns (address) {
    _nextAsset = asset;
    Join join = new Join{salt: keccak256(abi.encodePacked(asset))}();
    _nextAsset = address(0);

    join.grantRole(join.ROOT(), msg.sender);
    join.renounceRole(join.ROOT(), address(this));
    
    emit JoinCreated(asset, address(join));

    return address(join);
  }

  /// @dev Only used by the Join constructor.
  /// @return The address token for the currently-constructing join.
  function nextAsset() external view override returns (address) {
    return _nextAsset;
  }
}