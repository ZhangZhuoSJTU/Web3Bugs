// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.4;

library Sig {
  /// @dev ECDSA V,R and S components encapsulated here as we may not always be able to accept a bytes signature
  struct Components {
    uint8 v;  
    bytes32 r;
    bytes32 s;
  }

  /// @param h Hashed data which was originally signed
  /// @param c signature struct containing V,R and S
  /// @return The recovered address
  function recover(bytes32 h, Components calldata c) internal pure returns (address) {
    // EIP-2 and malleable signatures...
    // see https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/cryptography/ECDSA.sol
    require(uint256(c.s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, 'invalid signature "s" value');
    require(c.v == 27 || c.v == 28, 'invalid signature "v" value');

    return ecrecover(h, c.v, c.r, c.s);
  }

  /// @param h Hashed data which was originally signed
  /// @param sig Valid ECDSA signature
  /// @dev splitAndRecover should only be used if it is known that the resulting 
  /// verifying bit (V) will be 27 || 28. Otherwise use recover, possibly calling split first.
  /// @return The recovered address
  function splitAndRecover(bytes32 h, bytes memory sig) internal pure returns (address) {
    (uint8 v, bytes32 r, bytes32 s) = split(sig);

    return ecrecover(h, v, r, s);
  }

  /// @param sig Valid ECDSA signature
  /// @return v The verification bit
  /// @return r First 32 bytes
  /// @return s Next 32 bytes
  function split(bytes memory sig) internal pure returns (uint8, bytes32, bytes32) {
    require(sig.length == 65, 'invalid signature length'); // TODO standardize error messages

    bytes32 r;
    bytes32 s;
    uint8 v;

    assembly {
      r := mload(add(sig, 32))
      s := mload(add(sig, 64))
      v := byte(0, mload(add(sig, 96)))
    }

    return (v, r, s);
  }
}
