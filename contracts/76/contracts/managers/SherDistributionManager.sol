// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/utils/math/Math.sol';

import './Manager.sol';
import '../interfaces/managers/ISherDistributionManager.sol';

// This contract contains logic for calculating and sending SHER tokens to stakers
// The idea of the Kors curve is that we pay max SHER tokens to stakers up until a certain TVL (i.e. $100M)
// Then we pay fewer and fewer SHER tokens to stakers as the TVL climbs (linear relationship)
// Until finally we pay 0 SHER tokens out to stakers who stake above a certain TVL (i.e. $600M)

/// @dev expects 6 decimals input tokens
contract SherDistributionManager is ISherDistributionManager, Manager {
  using SafeERC20 for IERC20;

  uint256 internal constant DECIMALS = 10**6;

  // The TVL at which max SHER rewards STOP i.e. 100M USDC
  uint256 internal immutable maxRewardsEndTVL;

  // The TVL at which SHER rewards stop entirely i.e. 600M USDC
  uint256 internal immutable zeroRewardsStartTVL;

  // The SHER tokens paid per USDC staked per second at the max rate
  uint256 internal immutable maxRewardsRate;

  // SHER token contract address
  IERC20 public immutable sher;

  /// @dev With `_maxRewardsRate` being 10**18, 1 USDC == 1 SHER per second (on flat part of curve)
  constructor(
    uint256 _maxRewardsEndTVL,
    uint256 _zeroRewardsStartTVL,
    uint256 _maxRewardsRate,
    IERC20 _sher
  ) {
    if (_maxRewardsEndTVL >= _zeroRewardsStartTVL) revert InvalidArgument();
    if (_maxRewardsRate == 0) revert ZeroArgument();
    if (address(_sher) == address(0)) revert ZeroArgument();

    maxRewardsEndTVL = _maxRewardsEndTVL;
    zeroRewardsStartTVL = _zeroRewardsStartTVL;
    maxRewardsRate = _maxRewardsRate;
    sher = _sher;

    emit Initialized(_maxRewardsEndTVL, _zeroRewardsStartTVL, _maxRewardsRate);
  }

  // This function is called (by core Sherlock contracrt) as soon as a staker stakes
  // Calculates the SHER tokens owed to the stake, then transfers the SHER to the Sherlock core contract
  // Staker won't actually receive these SHER tokens until the lockup has expired though
  /// @notice Caller will receive `_sher` SHER tokens based on `_amount` and `_period`
  /// @param _amount Amount of tokens (in USDC) staked
  /// @param _period Period of time for stake, in seconds
  /// @param _id ID for this NFT position
  /// @param _receiver Address that will be linked to this position
  /// @return _sher Amount of SHER tokens sent to Sherlock core contract
  /// @dev Calling contract will depend on before + after balance diff and return value
  /// @dev INCLUDES stake in calculation, function expects the `_amount` to be deposited already
  /// @dev If tvl=50 and amount=50, this means it is calculating SHER rewards for the first 50 tokens going in
  /// @dev Doesn't include whenNotPaused modifier as it's onlySherlockCore where pause is captured
  /// @dev `_id` and `_receiver` are unused in this implementation
  function pullReward(
    uint256 _amount,
    uint256 _period,
    uint256 _id,
    address _receiver
  ) external override onlySherlockCore returns (uint256 _sher) {
    // Uses calcReward() to get the SHER tokens owed to this stake
    // Subtracts the amount from the total token balance to get the pre-stake USDC TVL
    _sher = calcReward(sherlockCore.totalTokenBalanceStakers() - _amount, _amount, _period);
    // Sends the SHER tokens to the core Sherlock contract where they are held until the unlock period for the stake expires
    if (_sher != 0) sher.safeTransfer(msg.sender, _sher);
  }

  /// @notice Calculates how many `_sher` SHER tokens are owed to a stake position based on `_amount` and `_period`
  /// @param _tvl TVL to use for reward calculation (pre-stake TVL)
  /// @param _amount Amount of tokens (USDC) staked
  /// @param _period Stake period (in seconds)
  /// @return _sher Amount of SHER tokens owed to this stake position
  /// @dev EXCLUDES `_amount` of stake, this will be added on top of TVL (_tvl is excluding _amount)
  /// @dev If tvl=0 and amount=50, it would calculate for the first 50 tokens going in (different from pullReward())
  function calcReward(
    uint256 _tvl,
    uint256 _amount,
    uint256 _period
  ) public view override returns (uint256 _sher) {
    if (_amount == 0) return 0;

    // Figures out how much of this stake should receive max rewards
    // _tvl is the pre-stake TVL (call it $80M) and maxRewardsEndTVL could be $100M
    // If maxRewardsEndTVL is bigger than the pre-stake TVL, then some or all of the stake could receive max rewards
    // In this case, the amount of the stake to receive max rewards is maxRewardsEndTVL - _tvl
    // Otherwise, the pre-stake TVL could be bigger than the maxRewardsEndTVL, in which case 0 max rewards are available
    uint256 maxRewardsAvailable = maxRewardsEndTVL > _tvl ? maxRewardsEndTVL - _tvl : 0;

    // Same logic as above for the TVL at which all SHER rewards end
    // If the pre-stake TVL is lower than the zeroRewardsStartTVL, then SHER rewards are still available to all or part of the stake
    // The starting point of the slopeRewards is calculated using max(maxRewardsEndTVL, tvl).
    // The starting point is either the beginning of the slope --> maxRewardsEndTVL
    // Or it's the current amount of TVL in case the point on the curve is already on the slope.
    uint256 slopeRewardsAvailable = zeroRewardsStartTVL > _tvl
      ? zeroRewardsStartTVL - Math.max(maxRewardsEndTVL, _tvl)
      : 0;

    // If there are some max rewards available...
    if (maxRewardsAvailable != 0) {
      // And if the entire stake is still within the maxRewardsAvailable amount
      if (_amount <= maxRewardsAvailable) {
        // Then the entire stake amount should accrue max SHER rewards
        return (_amount * maxRewardsRate * _period) / DECIMALS;
      } else {
        // Otherwise, the stake takes all the maxRewardsAvailable left and the calc continues
        // We add the maxRewardsAvailable amount to the TVL (now _tvl should be equal to maxRewardsEndTVL)
        _tvl += maxRewardsAvailable;
        // We subtract the amount of the stake that received max rewards
        _amount -= maxRewardsAvailable;

        // We accrue the max rewards available at the max rewards rate for the stake period to the SHER balance
        // This could be: $20M of maxRewardsAvailable which gets paid .01 SHER per second (max rate) for 3 months worth of seconds
        // Calculation continues after this
        _sher = (maxRewardsAvailable * maxRewardsRate * _period) / DECIMALS;
      }
    }

    // If there are SHER rewards still available (we didn't surpass zeroRewardsStartTVL)...
    if (slopeRewardsAvailable != 0) {
      // If the amount left is greater than the slope rewards available, we take all the remaining slope rewards
      if (_amount > slopeRewardsAvailable) _amount = slopeRewardsAvailable;

      // We take the average position on the slope that the stake amount occupies
      // This excludes any stake amount <= maxRewardsEndTVL or >= zeroRewardsStartTVL_
      // e.g. if tvl = 100m (and maxRewardsEndTVL is $100M), 50m is deposited, point at 125m is taken
      uint256 position = _tvl + (_amount / 2);

      // Calc SHER rewards based on position on the curve
      // (zeroRewardsStartTVL - position) divided by (zeroRewardsStartTVL - maxRewardsEndTVL) gives the % of max rewards the amount should get
      // Multiply this percentage by maxRewardsRate to get the rate at which this position should accrue SHER
      // Multiply by the _amount to get the full SHER amount earned per second
      // Multiply by the _period to get the total SHER amount owed to this position
      _sher +=
        (((zeroRewardsStartTVL - position) * _amount * maxRewardsRate * _period) /
          (zeroRewardsStartTVL - maxRewardsEndTVL)) /
        DECIMALS;
    }
  }

  /// @notice Function used to check if this is the current active distribution manager
  /// @return Boolean indicating it's active
  /// @dev If inactive the owner can pull all ERC20s and ETH
  /// @dev Will be checked by calling the sherlock contract
  function isActive() public view override returns (bool) {
    return address(sherlockCore.sherDistributionManager()) == address(this);
  }

  // Only contract owner can call this
  // Sends all specified tokens in this contract to the receiver's address (as well as ETH)
  function sweep(address _receiver, IERC20[] memory _extraTokens) external onlyOwner {
    if (_receiver == address(0)) revert ZeroArgument();
    // This contract must NOT be the current assigned distribution manager contract
    if (isActive()) revert InvalidConditions();
    // Executes the sweep for ERC-20s specified in _extraTokens as well as for ETH
    _sweep(_receiver, _extraTokens);
  }
}
