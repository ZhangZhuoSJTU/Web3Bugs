// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../governance/interfaces/IGovernanceAddressProvider.sol";
import "./interfaces/IBaseDistributor.sol";

contract DistributorManager {
  using SafeMath for uint256;

  IGovernanceAddressProvider public a;
  IBaseDistributor public mimmoDistributor;

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender), "Caller is not Manager");
    _;
  }

  constructor(IGovernanceAddressProvider _a, IBaseDistributor _mimmoDistributor) public {
    require(address(_a) != address(0));
    require(address(_mimmoDistributor) != address(0));

    a = _a;
    mimmoDistributor = _mimmoDistributor;
  }

  /**
    Public function to release the accumulated new MIMO tokens to the payees.
    @dev anyone can call this.
  */
  function releaseAll() public {
    mimmoDistributor.release();
    address[] memory distributors = mimmoDistributor.getPayees();
    for (uint256 i = 0; i < distributors.length; i++) {
      IBaseDistributor(distributors[i]).release();
    }
  }
}
