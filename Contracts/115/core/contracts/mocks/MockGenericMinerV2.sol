// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "../liquidityMining/v2/GenericMinerV2.sol";
import "../governance/interfaces/IGovernanceAddressProvider.sol";

contract MockGenericMinerV2 is GenericMinerV2 {
  constructor(IGovernanceAddressProvider _addresses, BoostConfig memory _boostConfig)
    public
    GenericMinerV2(_addresses, _boostConfig)
  {}

  function increaseStake(address user, uint256 value) public {
    _increaseStake(user, value);
  }

  function decreaseStake(address user, uint256 value) public {
    _decreaseStake(user, value);
  }
}
