// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.3;

import "./LongShortMockable.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/ITokenFactory.sol";
import "../../interfaces/ISyntheticToken.sol";
import "../../interfaces/IStaker.sol";
import "../../interfaces/ILongShort.sol";
import "../../interfaces/IYieldManager.sol";
import "../../interfaces/IOracleManager.sol";

contract LongShortForInternalMocking {
  function adminOnlyModifierLogicMock() public pure {
    return ();
  }

  function requireMarketExistsModifierLogicMock(uint32) public pure {
    return ();
  }

  function initializeMock(
    address,
    address,
    address,
    address
  ) public pure {
    return ();
  }

  function _seedMarketInitiallyMock(uint256, uint32) public pure {
    return ();
  }

  function _getMinMock(uint256, uint256) public pure returns (uint256) {
    return (abi.decode("", (uint256)));
  }

  function _getSyntheticTokenPriceMock(uint256, uint256) public pure returns (uint256 syntheticTokenPrice) {
    return (abi.decode("", (uint256)));
  }

  function _getAmountPaymentTokenMock(uint256, uint256) public pure returns (uint256 amountPaymentToken) {
    return (abi.decode("", (uint256)));
  }

  function _getAmountSyntheticTokenMock(uint256, uint256) public pure returns (uint256 amountSyntheticToken) {
    return (abi.decode("", (uint256)));
  }

  function _getEquivalentAmountSyntheticTokensOnTargetSideMock(
    uint256,
    uint256,
    uint256
  ) public pure returns (uint256 equivalentAmountSyntheticTokensOnTargetSide) {
    return (abi.decode("", (uint256)));
  }

  function getAmountSyntheticTokenToMintOnTargetSideMock(
    uint32,
    uint256,
    bool,
    uint256
  ) public pure returns (uint256 amountSyntheticTokensToMintOnTargetSide) {
    return (abi.decode("", (uint256)));
  }

  function getUsersConfirmedButNotSettledSynthBalanceMock(
    address,
    uint32,
    bool
  ) public pure returns (uint256 confirmedButNotSettledBalance) {
    return (abi.decode("", (uint256)));
  }

  function _getYieldSplitMock(
    uint32,
    uint256,
    uint256,
    uint256
  ) public pure returns (bool isLongSideUnderbalanced, uint256 treasuryYieldPercent_e18) {
    return (abi.decode("", (bool)), abi.decode("", (uint256)));
  }

  function _claimAndDistributeYieldThenRebalanceMarketMock(
    uint32,
    int256,
    int256
  ) public pure returns (uint256 longValue, uint256 shortValue) {
    return (abi.decode("", (uint256)), abi.decode("", (uint256)));
  }

  function _updateSystemStateInternalMock(uint32) public pure {
    return ();
  }

  function _transferPaymentTokensFromUserToYieldManagerMock(uint32, uint256) public pure {
    return ();
  }

  function _mintNextPriceMock(
    uint32,
    uint256,
    bool
  ) public pure {
    return ();
  }

  function _redeemNextPriceMock(
    uint32,
    uint256,
    bool
  ) public pure {
    return ();
  }

  function _shiftPositionNextPriceMock(
    uint32,
    uint256,
    bool
  ) public pure {
    return ();
  }

  function _executeOutstandingNextPriceMintsMock(
    uint32,
    address,
    bool
  ) public pure {
    return ();
  }

  function _executeOutstandingNextPriceRedeemsMock(
    uint32,
    address,
    bool
  ) public pure {
    return ();
  }

  function _executeOutstandingNextPriceTokenShiftsMock(
    uint32,
    address,
    bool
  ) public pure {
    return ();
  }

  function _executeOutstandingNextPriceSettlementsMock(address, uint32) public pure {
    return ();
  }

  function _handleTotalPaymentTokenValueChangeForMarketWithYieldManagerMock(uint32, int256) public pure {
    return ();
  }

  function _handleChangeInSyntheticTokensTotalSupplyMock(
    uint32,
    bool,
    int256
  ) public pure {
    return ();
  }

  function _batchConfirmOutstandingPendingActionsMock(
    uint32,
    uint256,
    uint256
  )
    public
    pure
    returns (int256 long_changeInMarketValue_inPaymentToken, int256 short_changeInMarketValue_inPaymentToken)
  {
    return (abi.decode("", (int256)), abi.decode("", (int256)));
  }
}
