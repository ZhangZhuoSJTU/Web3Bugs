// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "./GenericMiner.sol";
import "./interfaces/IVotingMiner.sol";
import "../governance/interfaces/IGovernanceAddressProvider.sol";
import "../governance/interfaces/IVotingEscrow.sol";

contract VotingMiner is IVotingMiner, GenericMiner {
  constructor(IGovernanceAddressProvider _addresses) public GenericMiner(_addresses) {}

  /**
    Releases the outstanding MIMO balance to the user.
    @param _user the address of the user for which the MIMO tokens will be released.
  */
  function releaseMIMO(address _user) public override {
    IVotingEscrow votingEscrow = a.votingEscrow();
    require((msg.sender == _user) || (msg.sender == address(votingEscrow)));

    UserInfo storage userInfo = _users[_user];
    _refresh();
    uint256 pending = userInfo.stake.rayMul(_accAmountPerShare.sub(userInfo.accAmountPerShare));
    _balanceTracker = _balanceTracker.sub(pending);
    userInfo.accAmountPerShare = _accAmountPerShare;

    uint256 votingPower = votingEscrow.balanceOf(_user);
    totalStake = totalStake.add(votingPower).sub(userInfo.stake);
    userInfo.stake = votingPower;

    if (pending > 0) {
      require(a.mimo().transfer(_user, pending));
    }
  }
}
