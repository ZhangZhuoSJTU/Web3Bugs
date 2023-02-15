// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";
import "../../interfaces/IFloatToken.sol";
import "../../interfaces/ILongShort.sol";
import "../../interfaces/IStaker.sol";
import "../../interfaces/ISyntheticToken.sol";

import "./StakerForInternalMocking.sol";
import "../StakerInternalStateSetters.sol";

contract StakerMockable is StakerInternalStateSetters {
  StakerForInternalMocking mocker;
  bool shouldUseMock;
  string functionToNotMock;

  function setMocker(StakerForInternalMocking _mocker) external {
    mocker = _mocker;
    shouldUseMock = true;
  }

  function setFunctionToNotMock(string calldata _functionToNotMock) external {
    functionToNotMock = _functionToNotMock;
  }

  function onlyAdminModifierLogicExposed() external {
    return super.onlyAdminModifierLogic();
  }

  function onlyAdminModifierLogic() internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("onlyAdminModifierLogic"))
    ) {
      return mocker.onlyAdminModifierLogicMock();
    } else {
      return super.onlyAdminModifierLogic();
    }
  }

  function onlyValidSyntheticModifierLogicExposed(address _synth) external {
    return super.onlyValidSyntheticModifierLogic(_synth);
  }

  function onlyValidSyntheticModifierLogic(address _synth) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("onlyValidSyntheticModifierLogic"))
    ) {
      return mocker.onlyValidSyntheticModifierLogicMock(_synth);
    } else {
      return super.onlyValidSyntheticModifierLogic(_synth);
    }
  }

  function onlyValidMarketModifierLogicExposed(uint32 marketIndex) external {
    return super.onlyValidMarketModifierLogic(marketIndex);
  }

  function onlyValidMarketModifierLogic(uint32 marketIndex) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("onlyValidMarketModifierLogic"))
    ) {
      return mocker.onlyValidMarketModifierLogicMock(marketIndex);
    } else {
      return super.onlyValidMarketModifierLogic(marketIndex);
    }
  }

  function onlyLongShortModifierLogicExposed() external {
    return super.onlyLongShortModifierLogic();
  }

  function onlyLongShortModifierLogic() internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("onlyLongShortModifierLogic"))
    ) {
      return mocker.onlyLongShortModifierLogicMock();
    } else {
      return super.onlyLongShortModifierLogic();
    }
  }

  function _changeFloatPercentageExposed(uint256 newFloatPercentage) external {
    return super._changeFloatPercentage(newFloatPercentage);
  }

  function _changeFloatPercentage(uint256 newFloatPercentage) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_changeFloatPercentage"))
    ) {
      return mocker._changeFloatPercentageMock(newFloatPercentage);
    } else {
      return super._changeFloatPercentage(newFloatPercentage);
    }
  }

  function _changeUnstakeFeeExposed(uint32 marketIndex, uint256 newMarketUnstakeFee_e18) external {
    return super._changeUnstakeFee(marketIndex, newMarketUnstakeFee_e18);
  }

  function _changeUnstakeFee(uint32 marketIndex, uint256 newMarketUnstakeFee_e18) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_changeUnstakeFee"))
    ) {
      return mocker._changeUnstakeFeeMock(marketIndex, newMarketUnstakeFee_e18);
    } else {
      return super._changeUnstakeFee(marketIndex, newMarketUnstakeFee_e18);
    }
  }

  function _changeMarketLaunchIncentiveParametersExposed(
    uint32 marketIndex,
    uint256 period,
    uint256 initialMultiplier
  ) external {
    return super._changeMarketLaunchIncentiveParameters(marketIndex, period, initialMultiplier);
  }

  function _changeMarketLaunchIncentiveParameters(
    uint32 marketIndex,
    uint256 period,
    uint256 initialMultiplier
  ) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_changeMarketLaunchIncentiveParameters"))
    ) {
      return mocker._changeMarketLaunchIncentiveParametersMock(marketIndex, period, initialMultiplier);
    } else {
      return super._changeMarketLaunchIncentiveParameters(marketIndex, period, initialMultiplier);
    }
  }

  function _changeBalanceIncentiveExponentExposed(uint32 marketIndex, uint256 _balanceIncentiveCurve_exponent)
    external
  {
    return super._changeBalanceIncentiveExponent(marketIndex, _balanceIncentiveCurve_exponent);
  }

  function _changeBalanceIncentiveExponent(uint32 marketIndex, uint256 _balanceIncentiveCurve_exponent)
    internal
    override
  {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_changeBalanceIncentiveExponent"))
    ) {
      return mocker._changeBalanceIncentiveExponentMock(marketIndex, _balanceIncentiveCurve_exponent);
    } else {
      return super._changeBalanceIncentiveExponent(marketIndex, _balanceIncentiveCurve_exponent);
    }
  }

  function _changeBalanceIncentiveEquilibriumOffsetExposed(
    uint32 marketIndex,
    int256 _balanceIncentiveCurve_equilibriumOffset
  ) external {
    return super._changeBalanceIncentiveEquilibriumOffset(marketIndex, _balanceIncentiveCurve_equilibriumOffset);
  }

  function _changeBalanceIncentiveEquilibriumOffset(uint32 marketIndex, int256 _balanceIncentiveCurve_equilibriumOffset)
    internal
    override
  {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_changeBalanceIncentiveEquilibriumOffset"))
    ) {
      return mocker._changeBalanceIncentiveEquilibriumOffsetMock(marketIndex, _balanceIncentiveCurve_equilibriumOffset);
    } else {
      return super._changeBalanceIncentiveEquilibriumOffset(marketIndex, _balanceIncentiveCurve_equilibriumOffset);
    }
  }

  function _getMarketLaunchIncentiveParametersExposed(uint32 marketIndex)
    external
    view
    returns (uint256 period, uint256 multiplier)
  {
    return super._getMarketLaunchIncentiveParameters(marketIndex);
  }

  function _getMarketLaunchIncentiveParameters(uint32 marketIndex)
    internal
    view
    override
    returns (uint256 period, uint256 multiplier)
  {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_getMarketLaunchIncentiveParameters"))
    ) {
      return mocker._getMarketLaunchIncentiveParametersMock(marketIndex);
    } else {
      return super._getMarketLaunchIncentiveParameters(marketIndex);
    }
  }

  function _getKValueExposed(uint32 marketIndex) external view returns (uint256) {
    return super._getKValue(marketIndex);
  }

  function _getKValue(uint32 marketIndex) internal view override returns (uint256) {
    if (shouldUseMock && keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_getKValue"))) {
      return mocker._getKValueMock(marketIndex);
    } else {
      return super._getKValue(marketIndex);
    }
  }

  function _calculateFloatPerSecondExposed(
    uint32 marketIndex,
    uint256 longPrice,
    uint256 shortPrice,
    uint256 longValue,
    uint256 shortValue
  ) external view returns (uint256 longFloatPerSecond, uint256 shortFloatPerSecond) {
    return super._calculateFloatPerSecond(marketIndex, longPrice, shortPrice, longValue, shortValue);
  }

  function _calculateFloatPerSecond(
    uint32 marketIndex,
    uint256 longPrice,
    uint256 shortPrice,
    uint256 longValue,
    uint256 shortValue
  ) internal view override returns (uint256 longFloatPerSecond, uint256 shortFloatPerSecond) {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_calculateFloatPerSecond"))
    ) {
      return mocker._calculateFloatPerSecondMock(marketIndex, longPrice, shortPrice, longValue, shortValue);
    } else {
      return super._calculateFloatPerSecond(marketIndex, longPrice, shortPrice, longValue, shortValue);
    }
  }

  function _calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotExposed(uint32 marketIndex)
    external
    view
    returns (uint256)
  {
    return super._calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshot(marketIndex);
  }

  function _calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshot(uint32 marketIndex)
    internal
    view
    override
    returns (uint256)
  {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshot"))
    ) {
      return mocker._calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotMock(marketIndex);
    } else {
      return super._calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshot(marketIndex);
    }
  }

  function _calculateNewCumulativeIssuancePerStakedSynthExposed(
    uint32 marketIndex,
    uint256 longPrice,
    uint256 shortPrice,
    uint256 longValue,
    uint256 shortValue
  ) external view returns (uint256 longCumulativeRates, uint256 shortCumulativeRates) {
    return
      super._calculateNewCumulativeIssuancePerStakedSynth(marketIndex, longPrice, shortPrice, longValue, shortValue);
  }

  function _calculateNewCumulativeIssuancePerStakedSynth(
    uint32 marketIndex,
    uint256 longPrice,
    uint256 shortPrice,
    uint256 longValue,
    uint256 shortValue
  ) internal view override returns (uint256 longCumulativeRates, uint256 shortCumulativeRates) {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_calculateNewCumulativeIssuancePerStakedSynth"))
    ) {
      return
        mocker._calculateNewCumulativeIssuancePerStakedSynthMock(
          marketIndex,
          longPrice,
          shortPrice,
          longValue,
          shortValue
        );
    } else {
      return
        super._calculateNewCumulativeIssuancePerStakedSynth(marketIndex, longPrice, shortPrice, longValue, shortValue);
    }
  }

  function _setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotExposed(
    uint32 marketIndex,
    uint256 longPrice,
    uint256 shortPrice,
    uint256 longValue,
    uint256 shortValue
  ) external {
    return
      super._setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshot(
        marketIndex,
        longPrice,
        shortPrice,
        longValue,
        shortValue
      );
  }

  function _setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshot(
    uint32 marketIndex,
    uint256 longPrice,
    uint256 shortPrice,
    uint256 longValue,
    uint256 shortValue
  ) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshot"))
    ) {
      return
        mocker._setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotMock(
          marketIndex,
          longPrice,
          shortPrice,
          longValue,
          shortValue
        );
    } else {
      return
        super._setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshot(
          marketIndex,
          longPrice,
          shortPrice,
          longValue,
          shortValue
        );
    }
  }

  function _calculateAccumulatedFloatInRangeExposed(
    uint32 marketIndex,
    uint256 amountStakedLong,
    uint256 amountStakedShort,
    uint256 rewardIndexFrom,
    uint256 rewardIndexTo
  ) external view returns (uint256 floatReward) {
    return
      super._calculateAccumulatedFloatInRange(
        marketIndex,
        amountStakedLong,
        amountStakedShort,
        rewardIndexFrom,
        rewardIndexTo
      );
  }

  function _calculateAccumulatedFloatInRange(
    uint32 marketIndex,
    uint256 amountStakedLong,
    uint256 amountStakedShort,
    uint256 rewardIndexFrom,
    uint256 rewardIndexTo
  ) internal view override returns (uint256 floatReward) {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_calculateAccumulatedFloatInRange"))
    ) {
      return
        mocker._calculateAccumulatedFloatInRangeMock(
          marketIndex,
          amountStakedLong,
          amountStakedShort,
          rewardIndexFrom,
          rewardIndexTo
        );
    } else {
      return
        super._calculateAccumulatedFloatInRange(
          marketIndex,
          amountStakedLong,
          amountStakedShort,
          rewardIndexFrom,
          rewardIndexTo
        );
    }
  }

  function _calculateAccumulatedFloatExposed(uint32 marketIndex, address user) external returns (uint256 floatReward) {
    return super._calculateAccumulatedFloat(marketIndex, user);
  }

  function _calculateAccumulatedFloat(uint32 marketIndex, address user)
    internal
    override
    returns (uint256 floatReward)
  {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_calculateAccumulatedFloat"))
    ) {
      return mocker._calculateAccumulatedFloatMock(marketIndex, user);
    } else {
      return super._calculateAccumulatedFloat(marketIndex, user);
    }
  }

  function _mintFloatExposed(address user, uint256 floatToMint) external {
    return super._mintFloat(user, floatToMint);
  }

  function _mintFloat(address user, uint256 floatToMint) internal override {
    if (shouldUseMock && keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_mintFloat"))) {
      return mocker._mintFloatMock(user, floatToMint);
    } else {
      return super._mintFloat(user, floatToMint);
    }
  }

  function _mintAccumulatedFloatExposed(uint32 marketIndex, address user) external {
    return super._mintAccumulatedFloat(marketIndex, user);
  }

  function _mintAccumulatedFloat(uint32 marketIndex, address user) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_mintAccumulatedFloat"))
    ) {
      return mocker._mintAccumulatedFloatMock(marketIndex, user);
    } else {
      return super._mintAccumulatedFloat(marketIndex, user);
    }
  }

  function _mintAccumulatedFloatMultiExposed(uint32[] calldata marketIndexes, address user) external {
    return super._mintAccumulatedFloatMulti(marketIndexes, user);
  }

  function _mintAccumulatedFloatMulti(uint32[] calldata marketIndexes, address user) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_mintAccumulatedFloatMulti"))
    ) {
      return mocker._mintAccumulatedFloatMultiMock(marketIndexes, user);
    } else {
      return super._mintAccumulatedFloatMulti(marketIndexes, user);
    }
  }

  function stakeFromUser(address from, uint256 amount) public override onlyValidSynthetic((msg.sender)) {
    if (
      shouldUseMock && keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("stakeFromUser"))
    ) {
      return mocker.stakeFromUserMock(from, amount);
    } else {
      return super.stakeFromUser(from, amount);
    }
  }

  function _stakeExposed(
    address token,
    uint256 amount,
    address user
  ) external {
    return super._stake(token, amount, user);
  }

  function _stake(
    address token,
    uint256 amount,
    address user
  ) internal override {
    if (shouldUseMock && keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_stake"))) {
      return mocker._stakeMock(token, amount, user);
    } else {
      return super._stake(token, amount, user);
    }
  }

  function _withdrawExposed(
    uint32 marketIndex,
    address token,
    uint256 amount
  ) external {
    return super._withdraw(marketIndex, token, amount);
  }

  function _withdraw(
    uint32 marketIndex,
    address token,
    uint256 amount
  ) internal override {
    if (shouldUseMock && keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_withdraw"))) {
      return mocker._withdrawMock(marketIndex, token, amount);
    } else {
      return super._withdraw(marketIndex, token, amount);
    }
  }
}
