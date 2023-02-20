// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.4;

/**
  @notice Encapsulation of the logic to produce EIP712 hashed domain and messages.
  Also to produce / verify hashed and signed Permits.
*/

library Hash {
  // EIP712 Domain Separator typeHash
  // keccak256(abi.encodePacked(
  //     'EIP712Domain(',
  //     'string name,',
  //     'string version,',
  //     'uint256 chainId,',
  //     'address verifyingContract',
  //     ')'
  // ));
  bytes32 constant internal DOMAIN_TYPEHASH = 0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;

  // EIP2612 typeHash of a Permit
  // keccak256(abi.encodePacked(
  //     'Permit(',
  //     'address owner,',
  //     'address spender,',
  //     'uint256 value,',
  //     'uint256 nonce,',
  //     'uint256 deadline,',
  //     ')'
  // ));
  bytes32 constant internal PERMIT_TYPEHASH = 0x80772249b4aef1688b30651778f4249b05cb73b517d98482439b9d8999b30602;

  /// @param n EIP712 domain name
  /// @param version EIP712 semantic version string
  /// @param i Chain ID
  /// @param verifier address of the verifying contract
  function domain(string memory n, string memory version, uint256 i, address verifier) internal pure returns (bytes32) {
    bytes32 hash;

    assembly {
      let nameHash := keccak256(add(n, 32), mload(n))
      let versionHash := keccak256(add(version, 32), mload(version))
      let pointer := mload(64)
      mstore(pointer, DOMAIN_TYPEHASH)
      mstore(add(pointer, 32), nameHash)
      mstore(add(pointer, 64), versionHash)
      mstore(add(pointer, 96), i)
      mstore(add(pointer, 128), verifier)
      hash := keccak256(pointer, 160)
    }

    return hash;
  }

  /// @param d Type hash of the domain separator (see Hash.domain)
  /// @param h EIP712 hash struct (Permit for example)
  function message(bytes32 d, bytes32 h) internal pure returns (bytes32) {
    bytes32 hash;

    assembly {
      let pointer := mload(64)
      mstore(pointer, 0x1901000000000000000000000000000000000000000000000000000000000000)
      mstore(add(pointer, 2), d)
      mstore(add(pointer, 34), h)
      hash := keccak256(pointer, 66)
    }

    return hash;
  }

  /// @param o Address of the owner
  /// @param s Address of the spender
  /// @param a Amount to be approved
  /// @param n Current nonce
  /// @param d Deadline at which the permission is no longer valid
  function permit(address o, address s, uint256 a, uint256 n, uint256 d) internal pure returns (bytes32) {
    return keccak256(abi.encode(PERMIT_TYPEHASH, o, s, a, n, d));
  }
}
