// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "../liquidityMining/GenericMiner.sol";
import "../governance/interfaces/IGovernanceAddressProvider.sol";

contract MockGenericMiner is GenericMiner {
  constructor(IGovernanceAddressProvider _addresses) public GenericMiner(_addresses) {}

  function increaseStake(address user, uint256 value) public {
    _increaseStake(user, value);
  }

  function decreaseStake(address user, uint256 value) public {
    _decreaseStake(user, value);
  }
}
