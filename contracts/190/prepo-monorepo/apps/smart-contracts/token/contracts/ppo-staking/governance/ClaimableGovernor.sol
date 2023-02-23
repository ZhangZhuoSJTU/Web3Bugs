// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {Governable} from "./Governable.sol";

/**
 * @title   ClaimableGovernor
 * @author  mStable
 * @notice  2 way handshake for Governance transfer
 * @dev     Overrides the public functions in Governable to provide
 * a second step of validation.
 *          VERSION: 1.1
 *          DATE:    2021-04-15
 */
contract ClaimableGovernor is Governable {
  event GovernorChangeClaimed(address indexed proposedGovernor);
  event GovernorChangeCancelled(
    address indexed governor,
    address indexed proposed
  );
  event GovernorChangeRequested(
    address indexed governor,
    address indexed proposed
  );

  address public proposedGovernor = address(0);

  /**
   * @dev Throws if called by any account other than the Proposed Governor.
   */
  modifier onlyProposedGovernor() {
    require(msg.sender == proposedGovernor, "Sender is not proposed governor");
    _;
  }

  constructor(address _governorAddr) {
    _changeGovernor(_governorAddr);
  }

  // @override
  function changeGovernor(address) external view override onlyGovernor {
    revert("Direct change not allowed");
  }

  /**
   * @dev Current Governor request to proposes a new Governor
   * @param _proposedGovernor Address of the proposed Governor
   */
  function requestGovernorChange(address _proposedGovernor)
    public
    virtual
    onlyGovernor
  {
    require(
      _proposedGovernor != address(0),
      "Proposed governor is address(0)"
    );
    require(proposedGovernor == address(0), "Proposed governor already set");

    proposedGovernor = _proposedGovernor;
    emit GovernorChangeRequested(governor(), _proposedGovernor);
  }

  /**
   * @dev Current Governor cancel Governor change request
   */
  function cancelGovernorChange() public virtual onlyGovernor {
    require(proposedGovernor != address(0), "Proposed Governor not set");

    emit GovernorChangeCancelled(governor(), proposedGovernor);
    proposedGovernor = address(0);
  }

  /**
   * @dev Proposed Governor can claim governance ownership
   */
  function claimGovernorChange() public virtual onlyProposedGovernor {
    _changeGovernor(proposedGovernor);
    emit GovernorChangeClaimed(proposedGovernor);
    proposedGovernor = address(0);
  }
}
