// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {IGovernanceHook} from "../../governance/staking/interfaces/IGovernanceHook.sol";
import {GamifiedVotingToken} from "../../governance/staking/GamifiedVotingToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockEmissionController is IGovernanceHook {
  struct Dial {
    uint256 votes;
  }

  Dial[] public dials;

  struct PreferenceData {
    uint256 sum;
    uint256 count;
    Preference[] prefs;
  }

  struct Preference {
    uint256 id;
    uint256 weight;
  }
  // user => preferences
  // uint256 is 256 slots to store dial information. We can store the array positions of a users preferences in a single slot
  mapping(address => uint256) public preferenceBitmaps;
  bool init;

  mapping(address => bool) public stakingContracts;
  address[] public stakingContractsArr;

  modifier onlyStakingContract() {
    require(
      stakingContracts[msg.sender],
      "Must be whitelisted staking contract"
    );
    _;
  }

  constructor() {
    dials.push(Dial(1));
    dials.push(Dial(1));
    dials.push(Dial(1));
    dials.push(Dial(1));
  }

  function addStakingContract(address _stakingContract) external {
    require(!stakingContracts[_stakingContract], "Already whitelisted");
    require(
      IERC20(_stakingContract).totalSupply() == 0 || !init,
      "Cannot add existing contract while users have preferences"
    );
    stakingContractsArr.push(_stakingContract);
    stakingContracts[_stakingContract] = true;
  }

  function moveVotingPowerHook(
    address from,
    address to,
    uint256 amount
  ) external override onlyStakingContract {
    if (amount > 0) {
      if (from != address(0)) {
        _moveVotingPower(_getPreferences(from), amount, _subtract);
      }
      if (to != address(0)) {
        _moveVotingPower(_getPreferences(to), amount, _add);
      }
    }
  }

  // SITUATION 1: Stake, wait, set preferences
  // SITUATION 2: Set preferences, stake
  // SITUATION 3: NEW STAKING TOKEN. NOTE - this new staking token MUST be added to this contract
  // before any users have a balance. Otherwise, they can get a balance, and have existing preferences,
  // and it will never be added here. Require totalSupply of staking

  function setPreferences(uint256 _bitmap) external {
    if (!init) init = true;
    // 1. Get voting power sum from stakingContracts
    uint256 len = stakingContractsArr.length;
    uint256 votingPower = 0;
    for (uint256 i = 0; i < len; i++) {
      votingPower += GamifiedVotingToken(stakingContractsArr[i]).getVotes(
        msg.sender
      );
    }
    // 2. Fetch old bitmap and reduce all based on old preference
    _moveVotingPower(_getPreferences(msg.sender), votingPower, _subtract);
    // 3. Set new preferences
    preferenceBitmaps[msg.sender] = _bitmap;
    PreferenceData memory data = _getPreferences(msg.sender);
    require(data.count < 4, "Max 4 preferences to reduce gas");
    _moveVotingPower(data, votingPower, _add);
  }

  function _moveVotingPower(
    PreferenceData memory _preferenceData,
    uint256 _amount,
    function(uint256, uint256) view returns (uint256) _op
  ) internal {
    uint256 len = _preferenceData.count;
    for (uint256 i = 0; i < len; i++) {
      Preference memory pref = _preferenceData.prefs[i];
      // e.g. 5e17 * 1e18 / 1e18 * 100e18 / 1e18
      // = 50e18
      uint256 amountToChange = (((pref.weight * 1e18) / _preferenceData.sum) *
        _amount) / 1e18;
      dials[pref.id].votes = _op(dials[pref.id].votes, amountToChange);
    }
  }

  function _add(uint256 a, uint256 b) private pure returns (uint256) {
    return a + b;
  }

  function _subtract(uint256 a, uint256 b) private pure returns (uint256) {
    return a - b;
  }

  function _getPreferences(address _account)
    internal
    view
    returns (PreferenceData memory preferences)
  {
    uint256 bitmap = preferenceBitmaps[_account];
    uint8 weighting;
    preferences.prefs = new Preference[](4);
    for (uint8 i = 0; i < 32; i++) {
      unchecked {
        weighting = uint8(bitmap >> (i * 8));
      }
      if (weighting > 0) {
        preferences.prefs[preferences.count] = Preference(i, weighting);
        preferences.sum += weighting;
        preferences.count++;
      }
    }
  }
}
