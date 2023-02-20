// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

abstract contract ILongShort {
  function updateSystemState(uint32 marketIndex) external virtual;

  function updateSystemStateMulti(uint32[] calldata marketIndex) external virtual;

  function getUsersConfirmedButNotSettledSynthBalance(
    address user,
    uint32 marketIndex,
    bool isLong
  ) external view virtual returns (uint256 confirmedButNotSettledBalance);

  function executeOutstandingNextPriceSettlementsUser(address user, uint32 marketIndex) external virtual;

  function shiftPositionFromLongNextPrice(uint32 marketIndex, uint256 amountSyntheticTokensToShift) external virtual;

  function shiftPositionFromShortNextPrice(uint32 marketIndex, uint256 amountSyntheticTokensToShift) external virtual;

  function getAmountSyntheticTokenToMintOnTargetSide(
    uint32 marketIndex,
    uint256 amountSyntheticTokenShiftedFromOneSide,
    bool isShiftFromLong,
    uint256 priceSnapshotIndex
  ) public view virtual returns (uint256 amountSynthShiftedToOtherSide);
}
