// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

library YieldValidator {
  uint256 private constant SECONDS_IN_YEAR = 365 days;
  uint256 private constant THIRTY_MINUTES = 30 minutes;

  uint256 private constant MAX_APY = 15e18;
  uint256 private constant TEN_BPS = 1e15;

  /**
   * @dev Validates that an interest collection does not exceed a maximum APY. If last collection
   * was under 30 mins ago, simply check it does not exceed 10bps
   * @param _newSupply               New total supply of the mAsset
   * @param _interest                Increase in total supply since last collection
   * @param _timeSinceLastCollection Seconds since last collection
   */
  function validateCollection(
    uint256 _newSupply,
    uint256 _interest,
    uint256 _timeSinceLastCollection
  ) internal pure returns (uint256 extrapolatedAPY) {
    return
      validateCollection(
        _newSupply,
        _interest,
        _timeSinceLastCollection,
        MAX_APY,
        TEN_BPS
      );
  }

  /**
   * @dev Validates that an interest collection does not exceed a maximum APY. If last collection
   * was under 30 mins ago, simply check it does not exceed 10bps
   * @param _newSupply               New total supply of the mAsset
   * @param _interest                Increase in total supply since last collection
   * @param _timeSinceLastCollection Seconds since last collection
   * @param _maxApy                  Max APY where 100% == 1e18
   * @param _baseApy                 If less than 30 mins, do not exceed this % increase
   */
  function validateCollection(
    uint256 _newSupply,
    uint256 _interest,
    uint256 _timeSinceLastCollection,
    uint256 _maxApy,
    uint256 _baseApy
  ) internal pure returns (uint256 extrapolatedAPY) {
    uint256 protectedTime = _timeSinceLastCollection == 0
      ? 1
      : _timeSinceLastCollection;

    // Percentage increase in total supply
    // e.g. (1e20 * 1e18) / 1e24 = 1e14 (or a 0.01% increase)
    // e.g. (5e18 * 1e18) / 1.2e24 = 4.1667e12
    // e.g. (1e19 * 1e18) / 1e21 = 1e16
    uint256 oldSupply = _newSupply - _interest;
    uint256 percentageIncrease = (_interest * 1e18) / oldSupply;

    //      If over 30 mins, extrapolate APY
    // e.g. day: (86400 * 1e18) / 3.154e7 = 2.74..e15
    // e.g. 30 mins: (1800 * 1e18) / 3.154e7 = 5.7..e13
    // e.g. epoch: (1593596907 * 1e18) / 3.154e7 = 50.4..e18
    uint256 yearsSinceLastCollection = (protectedTime * 1e18) /
      SECONDS_IN_YEAR;

    // e.g. 0.01% (1e14 * 1e18) / 2.74..e15 = 3.65e16 or 3.65% apr
    // e.g. (4.1667e12 * 1e18) / 5.7..e13 = 7.1e16 or 7.1% apr
    // e.g. (1e16 * 1e18) / 50e18 = 2e14
    extrapolatedAPY = (percentageIncrease * 1e18) / yearsSinceLastCollection;

    if (protectedTime > THIRTY_MINUTES) {
      require(
        extrapolatedAPY < _maxApy,
        "Interest protected from inflating past maxAPY"
      );
    } else {
      require(
        percentageIncrease < _baseApy,
        "Interest protected from inflating past 10 Bps"
      );
    }
  }
}
