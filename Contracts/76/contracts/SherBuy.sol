// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './interfaces/ISherClaim.sol';
import './interfaces/ISherlock.sol';

/// @title Buy SHER tokens by staking USDC and paying USDC
/// @author Evert Kors
/// @dev The goal is to get TVL in Sherlock.sol and raise funds with `receiver`
/// @dev Bought SHER tokens are moved to a timelock contract (SherClaim)
/// @dev Admin should SHER tokens to the contract rounded by 0.01 SHER, otherwise logic will break.
contract SherBuy {
  using SafeERC20 for IERC20;

  error InvalidSender();
  error InvalidAmount();
  error ZeroArgument();
  error InvalidState();
  error SoldOut();

  /// @notice Emitted when SHER purchase is executed
  /// @param buyer Account that bought SHER tokens
  /// @param amount How much SHER tokens are bought
  /// @param staked How much USDC is staked
  /// @param paid How much USDC is paid
  event Purchase(address indexed buyer, uint256 amount, uint256 staked, uint256 paid);

  // The staking period used for the staking USDC
  uint256 public constant PERIOD = 26 weeks;
  // Allows purchases in steps of 0.01 SHER
  uint256 internal constant SHER_STEPS = 10**16;
  // Allows stakeRate and buyRate with steps of 0.01 USDC
  uint256 internal constant RATE_STEPS = 10**4;
  // SHER has 18 decimals
  uint256 internal constant SHER_DECIMALS = 10**18;

  // SHER token address (18 decimals)
  IERC20 public immutable sher;
  // USDC token address (6 decimals)
  IERC20 public immutable usdc;

  // 10**6 means for every 1 SHER token you want to buy, you will stake 1 USDC (10**7 means 1 SHER for 10 USDC)
  uint256 public immutable stakeRate;
  // 10**6 means for every 1 SHER token you want to buy, you will pay 1 USDC (10**7 means 1 SHER for 10 USDC)
  uint256 public immutable buyRate;
  // The `Sherlock.sol` contract that is a ERC721
  ISherlock public immutable sherlockPosition;
  // Address receiving the USDC payments
  address public immutable receiver;
  // Contract to claim SHER at
  ISherClaim public immutable sherClaim;

  /// @notice Construct BuySher contract
  /// @param _sher ERC20 contract for SHER token
  /// @param _usdc ERC20 contract for USDC token
  /// @param _stakeRate Rate at which SHER tokens translate to the amount of USDC needed to be staked
  /// @param _buyRate Rate at which SHER tokens translate to the amount of USDC needed to be paid
  /// @param _sherlockPosition ERC721 contract of Sherlock positions
  /// @param _receiver Address that receives USDC from purchases
  /// @param _sherClaim Contract that keeps the SHER timelocked
  constructor(
    IERC20 _sher,
    IERC20 _usdc,
    uint256 _stakeRate,
    uint256 _buyRate,
    ISherlock _sherlockPosition,
    address _receiver,
    ISherClaim _sherClaim
  ) {
    if (address(_sher) == address(0)) revert ZeroArgument();
    if (address(_usdc) == address(0)) revert ZeroArgument();
    if (_stakeRate == 0) revert ZeroArgument();
    if (_stakeRate % RATE_STEPS != 0) revert InvalidState();
    if (_buyRate == 0) revert ZeroArgument();
    if (_buyRate % RATE_STEPS != 0) revert InvalidState();
    if (address(_sherlockPosition) == address(0)) revert ZeroArgument();
    if (_receiver == address(0)) revert ZeroArgument();
    if (address(_sherClaim) == address(0)) revert ZeroArgument();

    // Verify is PERIOD is active
    // Theoretically this period can be disabled during the lifetime of this contract, which will cause issues
    if (_sherlockPosition.stakingPeriods(PERIOD) == false) revert InvalidState();

    sher = _sher;
    usdc = _usdc;
    stakeRate = _stakeRate;
    buyRate = _buyRate;
    sherlockPosition = _sherlockPosition;
    receiver = _receiver;
    sherClaim = _sherClaim;

    // Do max approve in constructor as this contract will not hold any USDC
    usdc.approve(address(sherlockPosition), type(uint256).max);
  }

  /// @notice Check if the liquidity event is active
  /// @dev SHER tokens can run out while event is active
  /// @return True if the liquidity event is active
  function active() public view returns (bool) {
    // The claim contract will become active once the liquidity event is inactive
    return block.timestamp < sherClaim.claimableAt();
  }

  /// @notice View the capital requirements needed to buy up until `_sherAmountWant`
  /// @dev Will adjust to remaining SHER if `_sherAmountWant` exceeds that
  /// @return sherAmount Will adjust to remining SHER if `_sherAmountWant` exceeds that
  /// @return stake How much USDC needs to be staked for `PERIOD` of time to buy `sherAmount` SHER
  /// @return price How much USDC needs to be paid to buy `sherAmount` SHER
  function viewCapitalRequirements(uint256 _sherAmountWant)
    public
    view
    returns (
      uint256 sherAmount,
      uint256 stake,
      uint256 price
    )
  {
    // Only allow if liquidity event is active
    if (active() == false) revert InvalidState();
    // Zero isn't allowed
    if (_sherAmountWant == 0) revert ZeroArgument();

    // View how much SHER is still available to be sold
    uint256 available = sher.balanceOf(address(this));
    // If remaining SHER is 0 it's sold out
    if (available == 0) revert SoldOut();

    // Use remaining SHER if it's less then `_sherAmountWant`, otherwise go for `_sherAmountWant`
    // Remaining SHER will only be assigned on the last sale of this contract, `SoldOut()` error will be thrown after
    // sherAmount is not able to be zero as both 'available' and '_sherAmountWant' will be bigger than 0
    sherAmount = available < _sherAmountWant ? available : _sherAmountWant;
    // Only allows SHER amounts with certain precision steps
    // To ensure there is no rounding error at loss for the contract in stake / price calculation
    // Theoretically, if `available` is used, the function can fail if '% SHER_STEPS != 0' will be true
    // This can be caused by a griefer sending a small amount of SHER to the contract
    // Realistically, no SHER tokens will be on the market when this function is active
    // So it can only be caused if the admin sends too small amounts (documented at top of file with @dev)
    if (sherAmount % SHER_STEPS != 0) revert InvalidAmount();

    // Calculate how much USDC needs to be staked to buy `sherAmount`
    stake = (sherAmount * stakeRate) / SHER_DECIMALS;
    // Calculate how much USDC needs to be paid to buy `sherAmount`
    price = (sherAmount * buyRate) / SHER_DECIMALS;
  }

  /// @notice Buy up until `_sherAmountWant`
  /// @param _sherAmountWant The maximum amount of SHER the user wants to buy
  /// @dev Bought SHER tokens are moved to a timelock contract (SherClaim)
  /// @dev Will revert if liquidity event is inactive because of the viewCapitalRequirements call
  function execute(uint256 _sherAmountWant) external {
    // Calculate the capital requirements
    // Check how much SHER can actually be bought
    (uint256 sherAmount, uint256 stake, uint256 price) = viewCapitalRequirements(_sherAmountWant);

    // Transfer usdc from user to this, for staking (max is approved in constructor)
    usdc.safeTransferFrom(msg.sender, address(this), stake);
    // Transfer usdc from user to receiver, for payment of the SHER
    usdc.safeTransferFrom(msg.sender, receiver, price);

    // Stake usdc and send NFT to user
    sherlockPosition.initialStake(stake, PERIOD, msg.sender);
    // Approve in function as this contract will hold SHER tokens
    sher.approve(address(sherClaim), sherAmount);
    // Add bought SHER tokens to timelock for user
    sherClaim.add(msg.sender, sherAmount);

    // Emit event about the purchase
    emit Purchase(msg.sender, sherAmount, stake, price);
  }

  /// @notice Rescue remaining ERC20 tokens when liquidity event is inactive
  /// @param _tokens Array of ERC20 tokens to rescue
  /// @dev Can only be called by `receiver`
  function sweepTokens(IERC20[] memory _tokens) external {
    if (msg.sender != receiver) revert InvalidSender();
    if (active()) revert InvalidState();

    // Loops through the extra tokens (ERC20) provided and sends all of them to the sender address
    for (uint256 i; i < _tokens.length; i++) {
      IERC20 token = _tokens[i];
      token.safeTransfer(msg.sender, token.balanceOf(address(this)));
    }
  }
}
