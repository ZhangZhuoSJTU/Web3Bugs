// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PlatformTokenVendor} from "./PlatformTokenVendor.sol";

/**
 * @title  PlatformTokenVendorFactory
 * @author mStable
 * @notice Library that deploys a PlatformTokenVendor contract which holds rewards tokens
 * @dev    Used to reduce the byte size of the contracts that need to deploy a PlatformTokenVendor contract
 */
library PlatformTokenVendorFactory {
  /// @dev for some reason Typechain will not generate the types if the library only has the create function
  function dummy() public pure returns (bool) {
    return true;
  }

  /**
   * @notice Deploys a new PlatformTokenVendor contract
   * @param _rewardsToken reward or platform rewards token. eg MTA or WMATIC
   * @return address of the deployed PlatformTokenVendor contract
   */
  function create(IERC20 _rewardsToken) public returns (address) {
    PlatformTokenVendor newPlatformTokenVendor = new PlatformTokenVendor(
      _rewardsToken
    );
    return address(newPlatformTokenVendor);
  }
}
