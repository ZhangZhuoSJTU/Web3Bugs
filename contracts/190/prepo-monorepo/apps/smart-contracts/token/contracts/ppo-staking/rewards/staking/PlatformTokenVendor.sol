// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MassetHelpers} from "../../shared/MassetHelpers.sol";

/**
 * @title  PlatformTokenVendor
 * @author mStable
 * @notice Stores platform tokens for distributing to StakingReward participants
 * @dev    Only deploy this during the constructor of a given StakingReward contract
 */
contract PlatformTokenVendor {
  IERC20 public immutable platformToken;
  address public immutable parentStakingContract;

  /** @dev Simple constructor that stores the parent address */
  constructor(IERC20 _platformToken) {
    parentStakingContract = msg.sender;
    platformToken = _platformToken;
    MassetHelpers.safeInfiniteApprove(address(_platformToken), msg.sender);
  }

  /**
   * @dev Re-approves the StakingReward contract to spend the platform token.
   * Just incase for some reason approval has been reset.
   */
  function reApproveOwner() external {
    MassetHelpers.safeInfiniteApprove(
      address(platformToken),
      parentStakingContract
    );
  }
}
