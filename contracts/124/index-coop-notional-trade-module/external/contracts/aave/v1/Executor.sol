// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma abicoder v2;

import {ExecutorWithTimelock} from './ExecutorWithTimelock.sol';
import {ProposalValidator} from './ProposalValidator.sol';

/**
 * @title Time Locked, Validator, Executor Contract
 * @dev Contract
 * - Validate Proposal creations/ cancellation
 * - Validate Vote Quorum and Vote success on proposal
 * - Queue, Execute, Cancel, successful proposals' transactions.
 * @author Aave
 **/
contract Executor is ExecutorWithTimelock, ProposalValidator {
  constructor(
    address admin,
    uint256 delay,
    uint256 gracePeriod,
    uint256 minimumDelay,
    uint256 maximumDelay,
    uint256 propositionThreshold,
    uint256 voteDuration,
    uint256 voteDifferential,
    uint256 minimumQuorum
  )
    ExecutorWithTimelock(admin, delay, gracePeriod, minimumDelay, maximumDelay)
    ProposalValidator(propositionThreshold, voteDuration, voteDifferential, minimumQuorum)
  {}
}