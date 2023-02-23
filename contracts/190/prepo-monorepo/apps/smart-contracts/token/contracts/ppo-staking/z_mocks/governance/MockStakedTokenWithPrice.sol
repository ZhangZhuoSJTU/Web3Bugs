// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;
pragma abicoder v2;

import {StakedToken} from "../../governance/staking/StakedToken.sol";

/**
 * @title StakedTokenBPT
 * @dev Derives from StakedToken, and simply adds the ability to withdraw any unclaimed $BAL tokens
 * that are at this address
 **/
contract MockStakedTokenWithPrice is StakedToken {
  /// @notice Most recent PriceCoefficient
  uint256 public priceCoefficient;

  event PriceCoefficientUpdated(uint16 newPriceCoeff);

  constructor(
    address _nexus,
    address _rewardsToken,
    address _questManager,
    address _stakedToken,
    uint256 _cooldownSeconds,
    uint256 _unstakeWindow
  )
    StakedToken(
      _nexus,
      _rewardsToken,
      _questManager,
      _stakedToken,
      _cooldownSeconds,
      _unstakeWindow,
      true
    )
  {}

  function initialize(
    bytes32 _nameArg,
    bytes32 _symbolArg,
    address _rewardsDistributorArg
  ) external initializer {
    __StakedToken_init(_nameArg, _symbolArg, _rewardsDistributorArg);
    priceCoefficient = 10000;
  }

  /**
   * @dev Sets the recipient for any potential $BAL earnings
   */
  function setPriceCoefficient(uint16 _newCoeff) external {
    priceCoefficient = _newCoeff;

    emit PriceCoefficientUpdated(_newCoeff);
  }

  /**
   * @dev Get the current priceCoeff
   */
  function _getPriceCoeff() internal view override returns (uint256) {
    return priceCoefficient;
  }
}
