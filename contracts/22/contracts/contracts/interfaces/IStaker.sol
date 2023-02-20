// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

abstract contract IStaker {
  function addNewStakingFund(
    uint32 marketIndex,
    address longTokenAddress,
    address shortTokenAddress,
    uint256 kInitialMultiplier,
    uint256 kPeriod,
    uint256 unstakeFee_e18,
    uint256 _balanceIncentiveCurve_exponent,
    int256 _balanceIncentiveCurve_equilibriumOffset
  ) external virtual;

  function pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations(
    uint32 marketIndex,
    uint256 longTokenPrice,
    uint256 shortTokenPrice,
    uint256 longValue,
    uint256 shortValue,
    uint256 stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted
  ) external virtual;

  function stakeFromUser(address from, uint256 amount) public virtual;
}
