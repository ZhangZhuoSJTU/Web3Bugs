// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./GenericMinerV2.sol";
import "./interfaces/IVotingMinerV2.sol";
import "../../governance/interfaces/IGovernanceAddressProvider.sol";
import "../../governance/interfaces/IVotingEscrow.sol";

contract VotingMinerV2 is IVotingMinerV2, GenericMinerV2 {
  using SafeMath for uint256;

  constructor(IGovernanceAddressProvider _addresses, BoostConfig memory _boostConfig)
    public
    GenericMinerV2(_addresses, _boostConfig)
  {}

  /**
    Releases the outstanding MIMO balance to the user
    @param _user the address of the user for which the MIMO tokens will be released
  */
  function releaseMIMO(address _user) external {
    UserInfo memory _userInfo = _users[_user];
    _refresh();

    uint256 pendingMIMO = _pendingMIMO(_userInfo.stakeWithBoost, _userInfo.accAmountPerShare);
    uint256 pendingPAR = _pendingPAR(_userInfo.stakeWithBoost, _userInfo.accParAmountPerShare);

    if (_userInfo.stakeWithBoost > 0) {
      _mimoBalanceTracker = _mimoBalanceTracker.sub(pendingMIMO);
      _parBalanceTracker = _parBalanceTracker.sub(pendingPAR);
    }

    _syncStake(_user, _userInfo);

    _userInfo.accAmountPerShare = _accMimoAmountPerShare;
    _userInfo.accParAmountPerShare = _accParAmountPerShare;

    _updateBoost(_user, _userInfo);

    if (pendingMIMO > 0) {
      require(_a.mimo().transfer(_user, pendingMIMO), "LM100");
    }
    if (pendingPAR > 0) {
      require(_par.transfer(_user, pendingPAR), "LM100");
    }
  }

  /**
    Updates user stake based on current user baseDebt
    @dev this method is for upgradability purposes from an older VotingMiner to a newer one so the user doesn't have to call releaseMIMO() to set their stake in this VotingMiner
    @param _user address of the user
  */
  function syncStake(address _user) public override {
    UserInfo memory _userInfo = _users[_user];
    _syncStake(_user, _userInfo);
    _updateBoost(_user, _userInfo);
  }

  /**
    Updates user stake based on current user baseDebt
    @dev internal function to perform stake sync with VotingEscrow for both upgradability and relaseMIMO logic
    @param _user address of the user
  */
  function _syncStake(address _user, UserInfo memory _userInfo) internal {
    uint256 votingPower = _a.votingEscrow().balanceOf(_user);
    _totalStake = _totalStake.add(votingPower).sub(_userInfo.stake);
    _userInfo.stake = votingPower;
  }
}
