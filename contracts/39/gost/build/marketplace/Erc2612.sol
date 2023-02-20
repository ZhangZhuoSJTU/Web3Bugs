// SPDX-License-Identifier: GPL-3.0-or-later
// Adapted from OpenZeppelin ERC2612 (ERC20Permit)

pragma solidity 0.8.4;

import './Hash.sol';
import './PErc20.sol';
import './IErc2612.sol';

/**
* @dev Extension of {ERC20} that allows token holders to use their tokens
* without sending any transactions by setting {IERC20-allowance} with a
* signature using the {permit} method, and then spend them via
* {IERC20-transferFrom}.
* NOTE: Naming convention is kept OZStyle vs our own OzStyle to prevent clashing
*
* The {permit} signature mechanism conforms to the {IERC2612} interface.
*/
contract Erc2612 is PErc20, IErc2612 {
  mapping (address => uint256) public override nonces;

  bytes32 public immutable domain;

  /// @param n name for the token
  /// @param s symbol for the token
  /// @param d decimals for the token
  constructor(string memory n, string memory s, uint8 d) PErc20(n, s, d) {
    domain = Hash.domain(n, '1', block.chainid, address(this));
  }

  /**
  * @dev See {IERC2612-permit}.
  *
  * In cases where the free option is not a concern, deadline can simply be
  * set to uint(-1), so it should be seen as an optional parameter
  *
  * @param o Address of the owner
  * @param spender Address of the spender
  * @param a Amount to be approved
  * @param d Deadline at which the permission is no longer valid
  * NOTE: Last three args (v, r, s) are the components of a valid ECDSA signature
  */
  function permit(address o, address spender, uint256 a, uint256 d, uint8 v, bytes32 r, bytes32 s) public virtual override {
    require(d >= block.timestamp, 'erc2612 expired deadline');

    bytes32 hashStruct = Hash.permit(o, spender, a, nonces[o]++, d);
    bytes32 hash = Hash.message(domain, hashStruct); 
    address signer = ecrecover(hash, v, r, s);

    require(signer != address(0) && signer == o, 'erc2612 invalid signature');
    _approve(o, spender, a);
  }
}
