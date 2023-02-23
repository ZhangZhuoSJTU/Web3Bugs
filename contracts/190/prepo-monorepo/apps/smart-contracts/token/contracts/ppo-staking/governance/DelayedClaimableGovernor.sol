// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {ClaimableGovernor} from "./ClaimableGovernor.sol";

/**
 * @title   DelayedClaimableGovernor
 * @author  mStable
 * @notice  Current Governor can initiate governance change request.
 *          After a defined delay, proposed Governor can claim governance
 *          ownership.
 *          VERSION: 1.1
 *          DATE:    2021-04-15
 */
contract DelayedClaimableGovernor is ClaimableGovernor {
  uint256 public delay = 0;
  uint256 public requestTime = 0;

  /**
   * @dev Initializes the contract with given delay
   * @param _governorAddr Initial governor
   * @param _delay    Delay in seconds for 2 way handshake
   */
  constructor(address _governorAddr, uint256 _delay)
    ClaimableGovernor(_governorAddr)
  {
    require(_delay > 0, "Delay must be greater than zero");
    delay = _delay;
  }

  /**
   * @dev Requests change of governor and logs request time
   * @param _proposedGovernor Address of the new governor
   */
  function requestGovernorChange(address _proposedGovernor)
    public
    override
    onlyGovernor
  {
    requestTime = block.timestamp;
    super.requestGovernorChange(_proposedGovernor);
  }

  /**
   * @dev Cancels an outstanding governor change request by resetting request time
   */
  function cancelGovernorChange() public override onlyGovernor {
    requestTime = 0;
    super.cancelGovernorChange();
  }

  /**
   * @dev Proposed governor claims new position, callable after time elapsed
   */
  function claimGovernorChange() public override onlyProposedGovernor {
    require(block.timestamp >= (requestTime + delay), "Delay not over");
    super.claimGovernorChange();
    requestTime = 0;
  }
}
