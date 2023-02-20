// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.3;

import "./StakerMockable.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";
import "../../interfaces/IFloatToken.sol";
import "../../interfaces/ILongShort.sol";
import "../../interfaces/IStaker.sol";
import "../../interfaces/ISyntheticToken.sol";

contract StakerForInternalMocking {
  function onlyAdminModifierLogicMock() public pure {
    return ();
  }

  function onlyValidSyntheticModifierLogicMock(address) public pure {
    return ();
  }

  function onlyValidMarketModifierLogicMock(uint32) public pure {
    return ();
  }

  function onlyLongShortModifierLogicMock() public pure {
    return ();
  }

  function initializeMock(
    address,
    address,
    address,
    address,
    address,
    uint256
  ) public pure {
    return ();
  }

  function _changeFloatPercentageMock(uint256) public pure {
    return ();
  }

  function _changeUnstakeFeeMock(uint32, uint256) public pure {
    return ();
  }

  function _changeMarketLaunchIncentiveParametersMock(
    uint32,
    uint256,
    uint256
  ) public pure {
    return ();
  }

  function _changeBalanceIncentiveExponentMock(uint32, uint256) public pure {
    return ();
  }

  function _changeBalanceIncentiveEquilibriumOffsetMock(uint32, int256) public pure {
    return ();
  }

  function _getMarketLaunchIncentiveParametersMock(uint32) public pure returns (uint256 period, uint256 multiplier) {
    return (abi.decode("", (uint256)), abi.decode("", (uint256)));
  }

  function _getKValueMock(uint32) public pure returns (uint256) {
    return (abi.decode("", (uint256)));
  }

  function _calculateFloatPerSecondMock(
    uint32,
    uint256,
    uint256,
    uint256,
    uint256
  ) public pure returns (uint256 longFloatPerSecond, uint256 shortFloatPerSecond) {
    return (abi.decode("", (uint256)), abi.decode("", (uint256)));
  }

  function _calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotMock(uint32)
    public
    pure
    returns (uint256)
  {
    return (abi.decode("", (uint256)));
  }

  function _calculateNewCumulativeIssuancePerStakedSynthMock(
    uint32,
    uint256,
    uint256,
    uint256,
    uint256
  ) public pure returns (uint256 longCumulativeRates, uint256 shortCumulativeRates) {
    return (abi.decode("", (uint256)), abi.decode("", (uint256)));
  }

  function _setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotMock(
    uint32,
    uint256,
    uint256,
    uint256,
    uint256
  ) public pure {
    return ();
  }

  function _calculateAccumulatedFloatInRangeMock(
    uint32,
    uint256,
    uint256,
    uint256,
    uint256
  ) public pure returns (uint256 floatReward) {
    return (abi.decode("", (uint256)));
  }

  function _calculateAccumulatedFloatMock(uint32, address) public pure returns (uint256 floatReward) {
    return (abi.decode("", (uint256)));
  }

  function _mintFloatMock(address, uint256) public pure {
    return ();
  }

  function _mintAccumulatedFloatMock(uint32, address) public pure {
    return ();
  }

  function _mintAccumulatedFloatMultiMock(uint32[] memory, address) public pure {
    return ();
  }

  function stakeFromUserMock(address, uint256) public pure {
    return ();
  }

  function _stakeMock(
    address,
    uint256,
    address
  ) public pure {
    return ();
  }

  function shiftTokensMock(
    uint256,
    uint32,
    bool
  ) public pure {
    return ();
  }

  function _withdrawMock(
    uint32,
    address,
    uint256
  ) public pure {
    return ();
  }
}
