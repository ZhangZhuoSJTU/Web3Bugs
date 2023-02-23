// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "../governance/staking/PPOGamifiedToken.sol";

contract MockPPOGamifiedToken is PPOGamifiedToken {
  constructor(
    address _newNexus,
    address _newRewardsToken,
    address _newAchievementsManager
  ) PPOGamifiedToken(_newNexus, _newRewardsToken, _newAchievementsManager) {}

  function __mockPPOGamifiedToken_init(
    string memory _newName,
    string memory _newSymbol,
    address _newRewardsDistributor
  ) public initializer {
    __PPOGamifiedToken_init(_newName, _newSymbol, _newRewardsDistributor);
  }

  function totalSupply() public view override returns (uint256) {
    return 0;
  }

  function getScaledBalance(Balance memory _balance)
    external
    view
    returns (uint256)
  {
    return _scaleBalance(_balance);
  }

  function setAchievementsManager(address _newAchievementsManager) external {
    achievementsManager = IAchievementsManager(_newAchievementsManager);
  }

  function writeBalance(address _account, Balance memory _newBalance)
    external
  {
    _balances[_account] = _newBalance;
  }

  function enterCooldownPeriod(address _account, uint256 _units) external {
    _enterCooldownPeriod(_account, _units);
  }

  function exitCooldownPeriod(address _account) external {
    _exitCooldownPeriod(_account);
  }

  function mintRaw(
    address _account,
    uint256 _rawAmount,
    bool _exitCooldown
  ) external {
    _mintRaw(_account, _rawAmount, _exitCooldown);
  }

  function burnRaw(
    address _account,
    uint256 _rawAmount,
    bool _exitCooldown,
    bool _finalise
  ) external {
    _burnRaw(_account, _rawAmount, _exitCooldown, _finalise);
  }
}
