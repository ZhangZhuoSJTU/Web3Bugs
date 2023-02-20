// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

import "../interfaces/IYieldManager.sol";
import "../interfaces/aave/IAaveIncentivesController.sol";

/*
 * YieldManagerMock is an implementation of a yield manager that supports
 * configurable, deterministic token yields for testing. Note that the mock
 * needs to be able to mint the underlying token to simulate yield.
 */
contract YieldManagerMock is IYieldManager {
  // Admin contracts.
  address public admin;
  address public longShort;
  address public treasury;

  // Fixed-precision scale for interest percentages and fees.
  uint256 public constant TEN_TO_THE_18 = 1e18;

  // Global state.
  ERC20PresetMinterPauser public token;
  ERC20PresetMinterPauser public tokenOtherRewardERC20;

  uint256 public override totalReservedForTreasury;
  uint256 public totalHeld;

  uint256 public yieldRate; // pcnt per sec
  uint256 public lastSettled; // secs after epoch

  event ClaimAaveRewardTokenToTreasury(uint256 amount);

  ////////////////////////////////////
  /////////// MODIFIERS //////////////
  ////////////////////////////////////

  modifier longShortOnly() {
    require(msg.sender == longShort, "Not longShort");
    _;
  }

  ////////////////////////////////////
  ///// CONTRACT SET-UP //////////////
  ////////////////////////////////////

  constructor(
    address _longShort,
    address _treasury,
    address _token
  ) {
    // Admin contracts.
    longShort = _longShort;
    treasury = _treasury;

    // Global state.
    token = ERC20PresetMinterPauser(_token);
    lastSettled = block.timestamp;
  }

  ////////////////////////////////////
  ///// IMPLEMENTATION ///////////////
  ////////////////////////////////////

  /**
   * Adds the token's accrued yield to the token holdings.
   */
  function settle() public {
    uint256 totalYieldRate = yieldRate * (block.timestamp - lastSettled);
    uint256 totalYield = (totalHeld * totalYieldRate) / TEN_TO_THE_18;

    lastSettled = block.timestamp;
    totalHeld = totalHeld + totalYield;
    if (totalYield > 0) {
      token.mint(address(this), totalYield);
    }
  }

  /**
   * Adds the given yield percent to the token holdings.
   */
  function settleWithYieldPercent(uint256 yieldPercent) external {
    uint256 totalYield = (totalHeld * yieldPercent) / TEN_TO_THE_18;

    lastSettled = block.timestamp;
    totalHeld = totalHeld + totalYield;
    token.mint(address(this), totalYield);
  }

  /**
   * Adds the given absolute yield to the token holdings.
   */
  function settleWithYieldAbsolute(uint256 totalYield) external {
    lastSettled = block.timestamp;
    totalHeld = totalHeld + totalYield;
    token.mint(address(this), totalYield);
  }

  /**
   * Sets the yield percentage per second for the given token.
   */
  function setYieldRate(uint256 _yieldRate) external {
    yieldRate = _yieldRate;
  }

  function depositPaymentToken(uint256 amount) external override longShortOnly {
    // Ensure token state is current.
    settle();

    // Transfer tokens to manager contract.
    totalHeld = totalHeld + amount;
  }

  /// @notice Allows the LongShort pay out a user from tokens already withdrawn from Aave
  /// @param user User to recieve the payout
  /// @param amount Amount of payment token to pay to user
  function transferPaymentTokensToUser(address user, uint256 amount) external override longShortOnly {
    // Transfer tokens back to LongShort contract.
    token.transfer(user, amount);
  }

  function removePaymentTokenFromMarket(uint256 amount) external override longShortOnly {
    // Ensure token state is current.
    settle();
    require(amount <= totalHeld);

    totalHeld = totalHeld - amount;
  }

  function distributeYieldForTreasuryAndReturnMarketAllocation(
    uint256 totalValueRealizedForMarket,
    uint256 treasuryYieldPercent_e18
  ) external override longShortOnly returns (uint256) {
    uint256 unrealizedYield = totalHeld - totalValueRealizedForMarket - totalReservedForTreasury;

    if (unrealizedYield == 0) {
      return 0;
    }

    uint256 amountForTreasury = (unrealizedYield * treasuryYieldPercent_e18) / TEN_TO_THE_18;
    uint256 amountForMarketIncentives = unrealizedYield - amountForTreasury;

    totalReservedForTreasury += amountForTreasury;

    return amountForMarketIncentives;
  }

  function withdrawTreasuryFunds() external override longShortOnly {}
}
