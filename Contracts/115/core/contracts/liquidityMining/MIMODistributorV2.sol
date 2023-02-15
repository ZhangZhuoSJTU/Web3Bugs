// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/WadRayMath.sol";
import "../governance/interfaces/IGovernanceAddressProvider.sol";
import "./interfaces/IMIMODistributor.sol";
import "./BaseDistributor.sol";

contract MIMODistributorV2 is BaseDistributor, IMIMODistributorExtension {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private constant _SECONDS_PER_YEAR = 365 days;
  uint256 private constant _SECONDS_PER_WEEK = 7 days;
  uint256 private constant _WEEKLY_R = 986125e21; // -1.3875% per week (-5.55% / 4)
  uint256 private _FIRST_WEEK_TOKENS;

  uint256 public override startTime;
  uint256 public alreadyMinted;

  constructor(
    IGovernanceAddressProvider _a,
    uint256 _startTime,
    IMIMODistributor _mimoDistributor
  ) public {
    require(address(_a) != address(0));
    require(address(_mimoDistributor) != address(0));

    a = _a;
    startTime = _startTime;
    alreadyMinted = _mimoDistributor.totalSupplyAt(startTime);

    uint256 weeklyIssuanceV1 = _mimoDistributor.weeklyIssuanceAt(startTime);
    _FIRST_WEEK_TOKENS = weeklyIssuanceV1 / 4; // reduce weeky issuance by 4
  }

  /**
    Get current monthly issuance of new MIMO tokens.
    @return number of monthly issued tokens currently`.
  */
  function currentIssuance() public view override returns (uint256) {
    return weeklyIssuanceAt(now);
  }

  /**
    Get monthly issuance of new MIMO tokens at `timestamp`.
    @dev invalid for timestamps before deployment
    @param timestamp for which to calculate the monthly issuance
    @return number of monthly issued tokens at `timestamp`.
  */
  function weeklyIssuanceAt(uint256 timestamp) public view override returns (uint256) {
    uint256 elapsedSeconds = timestamp.sub(startTime);
    uint256 elapsedWeeks = elapsedSeconds.div(_SECONDS_PER_WEEK);
    return _WEEKLY_R.rayPow(elapsedWeeks).rayMul(_FIRST_WEEK_TOKENS);
  }

  /**
    Calculates how many MIMO tokens can be minted since the last time tokens were minted
    @return number of mintable tokens available right now.
  */
  function mintableTokens() public view override returns (uint256) {
    return totalSupplyAt(now).sub(a.mimo().totalSupply());
  }

  /**
    Calculates the totalSupply for any point after `startTime`
    @param timestamp for which to calculate the totalSupply
    @return totalSupply at timestamp.
  */
  function totalSupplyAt(uint256 timestamp) public view override returns (uint256) {
    uint256 elapsedSeconds = timestamp.sub(startTime);
    uint256 elapsedWeeks = elapsedSeconds.div(_SECONDS_PER_WEEK);
    uint256 lastWeekSeconds = elapsedSeconds % _SECONDS_PER_WEEK;
    uint256 one = WadRayMath.ray();
    uint256 fullWeeks = one.sub(_WEEKLY_R.rayPow(elapsedWeeks)).rayMul(_FIRST_WEEK_TOKENS).rayDiv(one.sub(_WEEKLY_R));
    uint256 currentWeekIssuance = weeklyIssuanceAt(timestamp);
    uint256 partialWeek = currentWeekIssuance.mul(lastWeekSeconds).div(_SECONDS_PER_WEEK);
    return alreadyMinted.add(fullWeeks.add(partialWeek));
  }

  /**
    Internal function to release a percentage of newTokens to a specific payee
    @dev uses totalShares to calculate correct share
    @param _totalnewTokensReceived Total newTokens for all payees, will be split according to shares
    @param _payee The address of the payee to whom to distribute the fees.
  */
  function _release(uint256 _totalnewTokensReceived, address _payee) internal override {
    uint256 payment = _totalnewTokensReceived.mul(shares[_payee]).div(totalShares);
    a.mimo().mint(_payee, payment);
  }
}
