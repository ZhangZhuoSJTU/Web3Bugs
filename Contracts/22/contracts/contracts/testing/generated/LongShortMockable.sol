// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/ITokenFactory.sol";
import "../../interfaces/ISyntheticToken.sol";
import "../../interfaces/IStaker.sol";
import "../../interfaces/ILongShort.sol";
import "../../interfaces/IYieldManager.sol";
import "../../interfaces/IOracleManager.sol";

import "./LongShortForInternalMocking.sol";
import "../LongShortInternalStateSetters.sol";

contract LongShortMockable is LongShortInternalStateSetters {
  LongShortForInternalMocking mocker;
  bool shouldUseMock;
  string functionToNotMock;

  function setMocker(LongShortForInternalMocking _mocker) external {
    mocker = _mocker;
    shouldUseMock = true;
  }

  function setFunctionToNotMock(string calldata _functionToNotMock) external {
    functionToNotMock = _functionToNotMock;
  }

  function adminOnlyModifierLogicExposed() external {
    return super.adminOnlyModifierLogic();
  }

  function adminOnlyModifierLogic() internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("adminOnlyModifierLogic"))
    ) {
      return mocker.adminOnlyModifierLogicMock();
    } else {
      return super.adminOnlyModifierLogic();
    }
  }

  function requireMarketExistsModifierLogicExposed(uint32 marketIndex) external view {
    return super.requireMarketExistsModifierLogic(marketIndex);
  }

  function requireMarketExistsModifierLogic(uint32 marketIndex) internal view override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("requireMarketExistsModifierLogic"))
    ) {
      return mocker.requireMarketExistsModifierLogicMock(marketIndex);
    } else {
      return super.requireMarketExistsModifierLogic(marketIndex);
    }
  }

  function _seedMarketInitiallyExposed(uint256 initialMarketSeedForEachMarketSide, uint32 marketIndex) external {
    return super._seedMarketInitially(initialMarketSeedForEachMarketSide, marketIndex);
  }

  function _seedMarketInitially(uint256 initialMarketSeedForEachMarketSide, uint32 marketIndex) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_seedMarketInitially"))
    ) {
      return mocker._seedMarketInitiallyMock(initialMarketSeedForEachMarketSide, marketIndex);
    } else {
      return super._seedMarketInitially(initialMarketSeedForEachMarketSide, marketIndex);
    }
  }

  function _getMinExposed(uint256 a, uint256 b) external pure returns (uint256) {
    return super._getMin(a, b);
  }

  function _getSyntheticTokenPriceExposed(uint256 amountPaymentTokenBackingSynth, uint256 amountSyntheticToken)
    external
    pure
    returns (uint256 syntheticTokenPrice)
  {
    return super._getSyntheticTokenPrice(amountPaymentTokenBackingSynth, amountSyntheticToken);
  }

  function _getAmountPaymentTokenExposed(uint256 amountSyntheticToken, uint256 syntheticTokenPriceInPaymentTokens)
    external
    pure
    returns (uint256 amountPaymentToken)
  {
    return super._getAmountPaymentToken(amountSyntheticToken, syntheticTokenPriceInPaymentTokens);
  }

  function _getAmountSyntheticTokenExposed(
    uint256 amountPaymentTokenBackingSynth,
    uint256 syntheticTokenPriceInPaymentTokens
  ) external pure returns (uint256 amountSyntheticToken) {
    return super._getAmountSyntheticToken(amountPaymentTokenBackingSynth, syntheticTokenPriceInPaymentTokens);
  }

  function _getEquivalentAmountSyntheticTokensOnTargetSideExposed(
    uint256 amountSyntheticTokens_originSide,
    uint256 syntheticTokenPrice_originSide,
    uint256 syntheticTokenPrice_targetSide
  ) external pure returns (uint256 equivalentAmountSyntheticTokensOnTargetSide) {
    return
      super._getEquivalentAmountSyntheticTokensOnTargetSide(
        amountSyntheticTokens_originSide,
        syntheticTokenPrice_originSide,
        syntheticTokenPrice_targetSide
      );
  }

  function getAmountSyntheticTokenToMintOnTargetSide(
    uint32 marketIndex,
    uint256 amountSyntheticToken_redeemOnOriginSide,
    bool isShiftFromLong,
    uint256 priceSnapshotIndex
  ) public view override returns (uint256 amountSyntheticTokensToMintOnTargetSide) {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("getAmountSyntheticTokenToMintOnTargetSide"))
    ) {
      return
        mocker.getAmountSyntheticTokenToMintOnTargetSideMock(
          marketIndex,
          amountSyntheticToken_redeemOnOriginSide,
          isShiftFromLong,
          priceSnapshotIndex
        );
    } else {
      return
        super.getAmountSyntheticTokenToMintOnTargetSide(
          marketIndex,
          amountSyntheticToken_redeemOnOriginSide,
          isShiftFromLong,
          priceSnapshotIndex
        );
    }
  }

  function _getYieldSplitExposed(
    uint32 marketIndex,
    uint256 longValue,
    uint256 shortValue,
    uint256 totalValueLockedInMarket
  ) external view returns (bool isLongSideUnderbalanced, uint256 treasuryYieldPercent_e18) {
    return super._getYieldSplit(marketIndex, longValue, shortValue, totalValueLockedInMarket);
  }

  function _getYieldSplit(
    uint32 marketIndex,
    uint256 longValue,
    uint256 shortValue,
    uint256 totalValueLockedInMarket
  ) internal view override returns (bool isLongSideUnderbalanced, uint256 treasuryYieldPercent_e18) {
    if (
      shouldUseMock && keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_getYieldSplit"))
    ) {
      return mocker._getYieldSplitMock(marketIndex, longValue, shortValue, totalValueLockedInMarket);
    } else {
      return super._getYieldSplit(marketIndex, longValue, shortValue, totalValueLockedInMarket);
    }
  }

  function _claimAndDistributeYieldThenRebalanceMarketExposed(
    uint32 marketIndex,
    int256 newAssetPrice,
    int256 oldAssetPrice
  ) external returns (uint256 longValue, uint256 shortValue) {
    return super._claimAndDistributeYieldThenRebalanceMarket(marketIndex, newAssetPrice, oldAssetPrice);
  }

  function _claimAndDistributeYieldThenRebalanceMarket(
    uint32 marketIndex,
    int256 newAssetPrice,
    int256 oldAssetPrice
  ) internal override returns (uint256 longValue, uint256 shortValue) {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_claimAndDistributeYieldThenRebalanceMarket"))
    ) {
      return mocker._claimAndDistributeYieldThenRebalanceMarketMock(marketIndex, newAssetPrice, oldAssetPrice);
    } else {
      return super._claimAndDistributeYieldThenRebalanceMarket(marketIndex, newAssetPrice, oldAssetPrice);
    }
  }

  function _updateSystemStateInternalExposed(uint32 marketIndex) external {
    return super._updateSystemStateInternal(marketIndex);
  }

  function _updateSystemStateInternal(uint32 marketIndex) internal override requireMarketExists(marketIndex) {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_updateSystemStateInternal"))
    ) {
      return mocker._updateSystemStateInternalMock(marketIndex);
    } else {
      return super._updateSystemStateInternal(marketIndex);
    }
  }

  function _transferPaymentTokensFromUserToYieldManagerExposed(uint32 marketIndex, uint256 amount) external {
    return super._transferPaymentTokensFromUserToYieldManager(marketIndex, amount);
  }

  function _transferPaymentTokensFromUserToYieldManager(uint32 marketIndex, uint256 amount) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_transferPaymentTokensFromUserToYieldManager"))
    ) {
      return mocker._transferPaymentTokensFromUserToYieldManagerMock(marketIndex, amount);
    } else {
      return super._transferPaymentTokensFromUserToYieldManager(marketIndex, amount);
    }
  }

  function _mintNextPriceExposed(
    uint32 marketIndex,
    uint256 amount,
    bool isLong
  ) external {
    return super._mintNextPrice(marketIndex, amount, isLong);
  }

  function _mintNextPrice(
    uint32 marketIndex,
    uint256 amount,
    bool isLong
  )
    internal
    override
    updateSystemStateMarket(marketIndex)
    executeOutstandingNextPriceSettlements(msg.sender, marketIndex)
  {
    if (
      shouldUseMock && keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_mintNextPrice"))
    ) {
      return mocker._mintNextPriceMock(marketIndex, amount, isLong);
    } else {
      return super._mintNextPrice(marketIndex, amount, isLong);
    }
  }

  function _redeemNextPriceExposed(
    uint32 marketIndex,
    uint256 tokens_redeem,
    bool isLong
  ) external {
    return super._redeemNextPrice(marketIndex, tokens_redeem, isLong);
  }

  function _redeemNextPrice(
    uint32 marketIndex,
    uint256 tokens_redeem,
    bool isLong
  )
    internal
    override
    updateSystemStateMarket(marketIndex)
    executeOutstandingNextPriceSettlements(msg.sender, marketIndex)
  {
    if (
      shouldUseMock && keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_redeemNextPrice"))
    ) {
      return mocker._redeemNextPriceMock(marketIndex, tokens_redeem, isLong);
    } else {
      return super._redeemNextPrice(marketIndex, tokens_redeem, isLong);
    }
  }

  function _shiftPositionNextPriceExposed(
    uint32 marketIndex,
    uint256 amountSyntheticTokensToShift,
    bool isShiftFromLong
  ) external {
    return super._shiftPositionNextPrice(marketIndex, amountSyntheticTokensToShift, isShiftFromLong);
  }

  function _shiftPositionNextPrice(
    uint32 marketIndex,
    uint256 amountSyntheticTokensToShift,
    bool isShiftFromLong
  )
    internal
    override
    updateSystemStateMarket(marketIndex)
    executeOutstandingNextPriceSettlements(msg.sender, marketIndex)
  {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_shiftPositionNextPrice"))
    ) {
      return mocker._shiftPositionNextPriceMock(marketIndex, amountSyntheticTokensToShift, isShiftFromLong);
    } else {
      return super._shiftPositionNextPrice(marketIndex, amountSyntheticTokensToShift, isShiftFromLong);
    }
  }

  function _executeOutstandingNextPriceMintsExposed(
    uint32 marketIndex,
    address user,
    bool isLong
  ) external {
    return super._executeOutstandingNextPriceMints(marketIndex, user, isLong);
  }

  function _executeOutstandingNextPriceMints(
    uint32 marketIndex,
    address user,
    bool isLong
  ) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) != keccak256(abi.encodePacked("_executeOutstandingNextPriceMints"))
    ) {
      return mocker._executeOutstandingNextPriceMintsMock(marketIndex, user, isLong);
    } else {
      return super._executeOutstandingNextPriceMints(marketIndex, user, isLong);
    }
  }

  function _executeOutstandingNextPriceRedeemsExposed(
    uint32 marketIndex,
    address user,
    bool isLong
  ) external {
    return super._executeOutstandingNextPriceRedeems(marketIndex, user, isLong);
  }

  function _executeOutstandingNextPriceRedeems(
    uint32 marketIndex,
    address user,
    bool isLong
  ) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_executeOutstandingNextPriceRedeems"))
    ) {
      return mocker._executeOutstandingNextPriceRedeemsMock(marketIndex, user, isLong);
    } else {
      return super._executeOutstandingNextPriceRedeems(marketIndex, user, isLong);
    }
  }

  function _executeOutstandingNextPriceTokenShiftsExposed(
    uint32 marketIndex,
    address user,
    bool isShiftFromLong
  ) external {
    return super._executeOutstandingNextPriceTokenShifts(marketIndex, user, isShiftFromLong);
  }

  function _executeOutstandingNextPriceTokenShifts(
    uint32 marketIndex,
    address user,
    bool isShiftFromLong
  ) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_executeOutstandingNextPriceTokenShifts"))
    ) {
      return mocker._executeOutstandingNextPriceTokenShiftsMock(marketIndex, user, isShiftFromLong);
    } else {
      return super._executeOutstandingNextPriceTokenShifts(marketIndex, user, isShiftFromLong);
    }
  }

  function _executeOutstandingNextPriceSettlementsExposed(address user, uint32 marketIndex) external {
    return super._executeOutstandingNextPriceSettlements(user, marketIndex);
  }

  function _executeOutstandingNextPriceSettlements(address user, uint32 marketIndex) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_executeOutstandingNextPriceSettlements"))
    ) {
      return mocker._executeOutstandingNextPriceSettlementsMock(user, marketIndex);
    } else {
      return super._executeOutstandingNextPriceSettlements(user, marketIndex);
    }
  }

  function _handleTotalPaymentTokenValueChangeForMarketWithYieldManagerExposed(
    uint32 marketIndex,
    int256 totalPaymentTokenValueChangeForMarket
  ) external {
    return
      super._handleTotalPaymentTokenValueChangeForMarketWithYieldManager(
        marketIndex,
        totalPaymentTokenValueChangeForMarket
      );
  }

  function _handleTotalPaymentTokenValueChangeForMarketWithYieldManager(
    uint32 marketIndex,
    int256 totalPaymentTokenValueChangeForMarket
  ) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_handleTotalPaymentTokenValueChangeForMarketWithYieldManager"))
    ) {
      return
        mocker._handleTotalPaymentTokenValueChangeForMarketWithYieldManagerMock(
          marketIndex,
          totalPaymentTokenValueChangeForMarket
        );
    } else {
      return
        super._handleTotalPaymentTokenValueChangeForMarketWithYieldManager(
          marketIndex,
          totalPaymentTokenValueChangeForMarket
        );
    }
  }

  function _handleChangeInSyntheticTokensTotalSupplyExposed(
    uint32 marketIndex,
    bool isLong,
    int256 changeInSyntheticTokensTotalSupply
  ) external {
    return super._handleChangeInSyntheticTokensTotalSupply(marketIndex, isLong, changeInSyntheticTokensTotalSupply);
  }

  function _handleChangeInSyntheticTokensTotalSupply(
    uint32 marketIndex,
    bool isLong,
    int256 changeInSyntheticTokensTotalSupply
  ) internal override {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_handleChangeInSyntheticTokensTotalSupply"))
    ) {
      return
        mocker._handleChangeInSyntheticTokensTotalSupplyMock(marketIndex, isLong, changeInSyntheticTokensTotalSupply);
    } else {
      return super._handleChangeInSyntheticTokensTotalSupply(marketIndex, isLong, changeInSyntheticTokensTotalSupply);
    }
  }

  function _batchConfirmOutstandingPendingActionsExposed(
    uint32 marketIndex,
    uint256 syntheticTokenPrice_inPaymentTokens_long,
    uint256 syntheticTokenPrice_inPaymentTokens_short
  ) external returns (int256 long_changeInMarketValue_inPaymentToken, int256 short_changeInMarketValue_inPaymentToken) {
    return
      super._batchConfirmOutstandingPendingActions(
        marketIndex,
        syntheticTokenPrice_inPaymentTokens_long,
        syntheticTokenPrice_inPaymentTokens_short
      );
  }

  function _batchConfirmOutstandingPendingActions(
    uint32 marketIndex,
    uint256 syntheticTokenPrice_inPaymentTokens_long,
    uint256 syntheticTokenPrice_inPaymentTokens_short
  )
    internal
    override
    returns (int256 long_changeInMarketValue_inPaymentToken, int256 short_changeInMarketValue_inPaymentToken)
  {
    if (
      shouldUseMock &&
      keccak256(abi.encodePacked(functionToNotMock)) !=
      keccak256(abi.encodePacked("_batchConfirmOutstandingPendingActions"))
    ) {
      return
        mocker._batchConfirmOutstandingPendingActionsMock(
          marketIndex,
          syntheticTokenPrice_inPaymentTokens_long,
          syntheticTokenPrice_inPaymentTokens_short
        );
    } else {
      return
        super._batchConfirmOutstandingPendingActions(
          marketIndex,
          syntheticTokenPrice_inPaymentTokens_long,
          syntheticTokenPrice_inPaymentTokens_short
        );
    }
  }
}
