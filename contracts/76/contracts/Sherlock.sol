// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/security/Pausable.sol';

import './interfaces/ISherlock.sol';

/// @title Sherlock core interface for stakers
/// @author Evert Kors
// This is the contract that manages staking actions

contract Sherlock is ISherlock, ERC721, Ownable, Pausable {
  using SafeERC20 for IERC20;

  // The initial period for a staker to restake/withdraw without being auto-restaked
  uint256 public constant ARB_RESTAKE_WAIT_TIME = 2 weeks;

  // The period during which the reward for restaking an account (after the inital period) grows
  uint256 public constant ARB_RESTAKE_GROWTH_TIME = 1 weeks;

  // Anyone who gets auto-restaked is restaked for this period (3 months)
  uint256 public constant ARB_RESTAKE_PERIOD = 12 weeks;

  // The percentage of someone's stake that can be paid to an arb for restaking
  uint256 public constant ARB_RESTAKE_MAX_PERCENTAGE = (10**18 / 100) * 20; // 20%

  // USDC address
  IERC20 public immutable token;

  // SHER token address
  IERC20 public immutable sher;

  // Key is the staking period (3 months, 6 months, etc.), value will be whether it is allowed or not
  mapping(uint256 => bool) public override stakingPeriods;

  // Key is a specific position ID (NFT ID), value represents the timestamp at which the position can be unstaked/restaked
  mapping(uint256 => uint256) internal lockupEnd_;

  // Key is NFT ID, value is the amount of SHER rewards owed to that NFT position
  mapping(uint256 => uint256) internal sherRewards_;

  // Key is NFT ID, value is the amount of shares representing the USDC owed to this position (includes principal, interest, etc.)
  mapping(uint256 => uint256) internal stakeShares;

  // Key is account, value is the sum of underlying shares of all the NFTs the account owns.
  mapping(address => uint256) internal addressShares;

  // Total amount of shares that have been issued to all NFT positions
  uint256 internal totalStakeShares;

  // Contract representing the current yield strategy (deposits staker funds into Aave, etc.)
  IStrategyManager public override yieldStrategy;

  // Instances of relevant Sherlock contracts
  ISherDistributionManager public override sherDistributionManager;
  ISherlockProtocolManager public override sherlockProtocolManager;
  ISherlockClaimManager public override sherlockClaimManager;

  // Address to which nonstaker payments are made
  // This will start out as a multi-sig address, then become a contract address later
  address public override nonStakersAddress;

  // Stores the ID of the most recently created NFT
  // This variable is incremented by 1 to create a new NFT ID
  uint256 internal nftCounter;

  // Even though `_sherDistributionManager` can be removed once deployed, every initial deployment will have an active instance.
  constructor(
    IERC20 _token, // USDC address
    IERC20 _sher, // SHER token address
    string memory _name, // Token collection name (see ERC-721 docs)
    string memory _symbol, // Token collection symbol (see ERC-721 docs)
    IStrategyManager _yieldStrategy, // The active yield strategy contract
    ISherDistributionManager _sherDistributionManager, // The active DistributionManager contract
    address _nonStakersAddress, // The address to which nonstakers payments go
    ISherlockProtocolManager _sherlockProtocolManager, // The address for the ProtocolManager contract
    ISherlockClaimManager _sherlockClaimManager, // The address for the ClaimManager contract
    uint256[] memory _initialstakingPeriods // The initial periods (3m, 6m, etc.) that someone can stake for
  ) ERC721(_name, _symbol) {
    if (address(_token) == address(0)) revert ZeroArgument();
    if (address(_sher) == address(0)) revert ZeroArgument();
    if (address(_yieldStrategy) == address(0)) revert ZeroArgument();
    if (address(_sherDistributionManager) == address(0)) revert ZeroArgument();
    if (_nonStakersAddress == address(0)) revert ZeroArgument();
    if (address(_sherlockProtocolManager) == address(0)) revert ZeroArgument();
    if (address(_sherlockClaimManager) == address(0)) revert ZeroArgument();

    token = _token;
    sher = _sher;
    yieldStrategy = _yieldStrategy;
    sherDistributionManager = _sherDistributionManager;
    nonStakersAddress = _nonStakersAddress;
    sherlockProtocolManager = _sherlockProtocolManager;
    sherlockClaimManager = _sherlockClaimManager;

    // Enabling the first set of staking periods that were provided in constructor args
    for (uint256 i; i < _initialstakingPeriods.length; i++) {
      enableStakingPeriod(_initialstakingPeriods[i]);
    }

    emit YieldStrategyUpdated(IStrategyManager(address(0)), _yieldStrategy);
    emit SherDistributionManagerUpdated(
      ISherDistributionManager(address(0)),
      _sherDistributionManager
    );
    emit NonStakerAddressUpdated(address(0), _nonStakersAddress);
    emit ProtocolManagerUpdated(ISherlockProtocolManager(address(0)), _sherlockProtocolManager);
    emit ClaimManagerUpdated(ISherlockClaimManager(address(0)), _sherlockClaimManager);
  }

  //
  // View functions
  //

  // Returns the timestamp at which the position represented by _tokenID can first be unstaked/restaked
  /// @notice View the current lockup end timestamp of `_tokenID`
  /// @return Timestamp when NFT position unlocks
  function lockupEnd(uint256 _tokenID) public view override returns (uint256) {
    if (!_exists(_tokenID)) revert NonExistent();

    return lockupEnd_[_tokenID];
  }

  // Returns the SHER rewards owed to this position
  /// @notice View the current SHER reward of `_tokenID`
  /// @return Amount of SHER rewarded to owner upon reaching the end of the lockup
  function sherRewards(uint256 _tokenID) public view override returns (uint256) {
    if (!_exists(_tokenID)) revert NonExistent();

    return sherRewards_[_tokenID];
  }

  // Returns the tokens (USDC) owed to a position
  /// @notice View the current token balance claimable upon reaching end of the lockup
  /// @return Amount of tokens assigned to owner when unstaking position
  function tokenBalanceOf(uint256 _tokenID) public view override returns (uint256) {
    if (!_exists(_tokenID)) revert NonExistent();
    // Finds the fraction of total shares owed to this position and multiplies by the total amount of tokens (USDC) owed to stakers
    return (stakeShares[_tokenID] * totalTokenBalanceStakers()) / totalStakeShares;
  }

  // Returns the tokens (USDC) owed to an address
  /// @notice View the current token balance claimable upon reaching all underlying positions at end of the lockup
  /// @return Amount of tokens assigned to owner when unstaking all positions
  function tokenBalanceOfAddress(address _staker) external view override returns (uint256) {
    if (_staker == address(0)) revert ZeroArgument();
    uint256 _totalStakeShares = totalStakeShares;
    if (_totalStakeShares == 0) return 0;
    // Finds the fraction of total shares owed to this address and multiplies by the total amount of tokens (USDC) owed to stakers
    return (addressShares[_staker] * totalTokenBalanceStakers()) / _totalStakeShares;
  }

  // Gets the total amount of tokens (USDC) owed to stakers
  // Adds this contract's balance, the tokens in the yield strategy, and the claimable premiums in the protocol manager contract
  /// @notice View the current TVL for all stakers
  /// @return Total amount of tokens staked
  /// @dev Adds principal + strategy + premiums
  /// @dev Will calculate the most up to date value for each piece
  function totalTokenBalanceStakers() public view override returns (uint256) {
    return
      token.balanceOf(address(this)) +
      yieldStrategy.balanceOf() +
      sherlockProtocolManager.claimablePremiums();
  }

  //
  // Gov functions
  //

  // Allows governance to add a new staking period (4 months, etc.)
  /// @notice Allows stakers to stake for `_period` of time
  /// @param _period Period of time, in seconds,
  /// @dev should revert if already enabled
  function enableStakingPeriod(uint256 _period) public override onlyOwner {
    if (_period == 0) revert ZeroArgument();
    // Revert if staking period is already active
    if (stakingPeriods[_period]) revert InvalidArgument();

    // Sets the staking period to true
    stakingPeriods[_period] = true;
    emit StakingPeriodEnabled(_period);
  }

  // Allows governance to remove a staking period (4 months, etc.)
  /// @notice Disallow stakers to stake for `_period` of time
  /// @param _period Period of time, in seconds,
  /// @dev should revert if already disabled
  function disableStakingPeriod(uint256 _period) external override onlyOwner {
    // Revert if staking period is already inactive
    if (!stakingPeriods[_period]) revert InvalidArgument();

    // Sets the staking period to false
    stakingPeriods[_period] = false;
    emit StakingPeriodDisabled(_period);
  }

  // Sets a new contract to be the active SHER distribution manager
  /// @notice Update SHER distribution manager contract
  /// @param _sherDistributionManager New adddress of the manager
  function updateSherDistributionManager(ISherDistributionManager _sherDistributionManager)
    external
    override
    onlyOwner
  {
    if (address(_sherDistributionManager) == address(0)) revert ZeroArgument();
    if (sherDistributionManager == _sherDistributionManager) revert InvalidArgument();

    emit SherDistributionManagerUpdated(sherDistributionManager, _sherDistributionManager);
    sherDistributionManager = _sherDistributionManager;
  }

  // Deletes the SHER distribution manager altogether (if Sherlock decides to no longer pay out SHER rewards)
  /// @notice Remove SHER token rewards
  function removeSherDistributionManager() external override onlyOwner {
    if (address(sherDistributionManager) == address(0)) revert InvalidConditions();

    emit SherDistributionManagerUpdated(
      sherDistributionManager,
      ISherDistributionManager(address(0))
    );
    delete sherDistributionManager;
  }

  // Sets a new address for nonstakers payments
  /// @notice Update address eligble for non staker rewards from protocol premiums
  /// @param _nonStakers Address eligble for non staker rewards
  function updateNonStakersAddress(address _nonStakers) external override onlyOwner {
    if (address(_nonStakers) == address(0)) revert ZeroArgument();
    if (nonStakersAddress == _nonStakers) revert InvalidArgument();

    emit NonStakerAddressUpdated(nonStakersAddress, _nonStakers);
    nonStakersAddress = _nonStakers;
  }

  // Sets a new protocol manager contract
  /// @notice Transfer protocol manager implementation address
  /// @param _protocolManager new implementation address
  function updateSherlockProtocolManager(ISherlockProtocolManager _protocolManager)
    external
    override
    onlyOwner
  {
    if (address(_protocolManager) == address(0)) revert ZeroArgument();
    if (sherlockProtocolManager == _protocolManager) revert InvalidArgument();

    emit ProtocolManagerUpdated(sherlockProtocolManager, _protocolManager);
    sherlockProtocolManager = _protocolManager;
  }

  // Sets a new claim manager contract
  /// @notice Transfer claim manager role to different address
  /// @param _claimManager New address of claim manager
  function updateSherlockClaimManager(ISherlockClaimManager _claimManager)
    external
    override
    onlyOwner
  {
    if (address(_claimManager) == address(0)) revert ZeroArgument();
    if (sherlockClaimManager == _claimManager) revert InvalidArgument();

    emit ClaimManagerUpdated(sherlockClaimManager, _claimManager);
    sherlockClaimManager = _claimManager;
  }

  // Sets a new yield strategy manager contract
  /// @notice Update yield strategy
  /// @param _yieldStrategy News address of the strategy
  /// @dev try a yieldStrategyWithdrawAll() on old, ignore failure
  function updateYieldStrategy(IStrategyManager _yieldStrategy) external override onlyOwner {
    if (address(_yieldStrategy) == address(0)) revert ZeroArgument();
    if (yieldStrategy == _yieldStrategy) revert InvalidArgument();

    // This call is surrounded with a try catch as there is a non-zero chance the underlying yield protocol(s) will fail
    // For example; the Aave V2 withdraw can fail in case there is not enough liquidity available for whatever reason.
    // In case this happens. We still want the yield strategy to be updated.
    // As the worst case could be that the Aave V2 withdraw will never work again, forcing us to never use a yield strategy ever again.
    try yieldStrategy.withdrawAll() {} catch (bytes memory reason) {
      emit YieldStrategyUpdateWithdrawAllError(reason);
    }

    emit YieldStrategyUpdated(yieldStrategy, _yieldStrategy);
    yieldStrategy = _yieldStrategy;
  }

  // Deposits a chosen amount of tokens (USDC) into the active yield strategy
  /// @notice Deposit `_amount` into active strategy
  /// @param _amount Amount of tokens
  /// @dev gov only
  function yieldStrategyDeposit(uint256 _amount) external override onlyOwner {
    if (_amount == 0) revert ZeroArgument();

    // Transfers any tokens owed to stakers from the protocol manager contract to this contract first
    sherlockProtocolManager.claimPremiumsForStakers();
    // Transfers the amount of tokens to the yield strategy contract
    token.safeTransfer(address(yieldStrategy), _amount);
    // Deposits all tokens in the yield strategy contract into the actual yield strategy
    yieldStrategy.deposit();
  }

  // Withdraws a chosen amount of tokens (USDC) from the yield strategy back into this contract
  /// @notice Withdraw `_amount` from active strategy
  /// @param _amount Amount of tokens
  /// @dev gov only
  function yieldStrategyWithdraw(uint256 _amount) external override onlyOwner {
    if (_amount == 0) revert ZeroArgument();

    yieldStrategy.withdraw(_amount);
  }

  // Withdraws all tokens from the yield strategy back into this contract
  /// @notice Withdraw all funds from active strategy
  /// @dev gov only
  function yieldStrategyWithdrawAll() external override onlyOwner {
    yieldStrategy.withdrawAll();
  }

  /// @notice Pause external functions in all contracts
  /// @dev A manager can be replaced with the new contract in a `paused` state
  /// @dev To ensure we are still able to pause all contracts, we check if the manager is unpaused
  function pause() external onlyOwner {
    _pause();
    if (!Pausable(address(yieldStrategy)).paused()) yieldStrategy.pause();
    // sherDistributionManager can be 0, pause isn't needed in that case
    if (
      address(sherDistributionManager) != address(0) &&
      !Pausable(address(sherDistributionManager)).paused()
    ) {
      sherDistributionManager.pause();
    }
    if (!Pausable(address(sherlockProtocolManager)).paused()) sherlockProtocolManager.pause();
    if (!Pausable(address(sherlockClaimManager)).paused()) sherlockClaimManager.pause();
  }

  /// @notice Unpause external functions in all contracts
  /// @dev A manager can be replaced with the new contract in an `unpaused` state
  /// @dev To ensure we are still able to unpause all contracts, we check if the manager is paused
  function unpause() external onlyOwner {
    _unpause();
    if (Pausable(address(yieldStrategy)).paused()) yieldStrategy.unpause();
    // sherDistributionManager can be 0, unpause isn't needed in that case
    if (
      address(sherDistributionManager) != address(0) &&
      Pausable(address(sherDistributionManager)).paused()
    ) {
      sherDistributionManager.unpause();
    }
    if (Pausable(address(sherlockProtocolManager)).paused()) sherlockProtocolManager.unpause();
    if (Pausable(address(sherlockClaimManager)).paused()) sherlockClaimManager.unpause();
  }

  //
  // Access control functions
  //

  /// @notice Account sum of all underlying posiiton shares for `_from` and `_to`
  /// @dev this enables the `tokenBalanceOfAddress` to exist
  function _beforeTokenTransfer(
    address _from,
    address _to,
    uint256 _tokenID
  ) internal override {
    uint256 _stakeShares = stakeShares[_tokenID];

    if (_from != address(0)) addressShares[_from] -= _stakeShares;
    if (_to != address(0)) addressShares[_to] += _stakeShares;
  }

  // Transfers specified amount of tokens to the address specified by the claim creator (protocol agent)
  // This function is called by the Sherlock claim manager contract if a claim is approved
  /// @notice Initiate a payout of `_amount` to `_receiver`
  /// @param _receiver Receiver of payout
  /// @param _amount Amount to send
  /// @dev only payout manager should call this
  /// @dev should pull money out of strategy
  function payoutClaim(address _receiver, uint256 _amount) external override whenNotPaused {
    // Can only be called by the Sherlock claim manager contract
    if (msg.sender != address(sherlockClaimManager)) revert Unauthorized();

    if (_amount != 0) {
      // Sends the amount of tokens to the receiver address (specified by the protocol agent who created the claim)
      _transferTokensOut(_receiver, _amount);
    }
    emit ClaimPayout(_receiver, _amount);
  }

  //
  // Non-access control functions
  //

  // Helper function for initial staking and restaking
  // Sets the unlock period, mints and transfers SHER tokens to this contract, assigns SHER tokens to this NFT position
  /// @notice Stakes `_amount` of tokens and locks up the `_id` position for `_period` seconds
  /// @param _amount Amount of tokens to stake
  /// @param _period Period of time for which funds get locked
  /// @param _id ID for this NFT position
  /// @param _receiver Address that will be linked to this position
  /// @return _sher Amount of SHER tokens awarded to this position after `_period` ends
  /// @dev `_period` needs to be whitelisted
  function _stake(
    uint256 _amount,
    uint256 _period,
    uint256 _id,
    address _receiver
  ) internal returns (uint256 _sher) {
    // Sets the timestamp at which this position can first be unstaked/restaked
    lockupEnd_[_id] = block.timestamp + _period;

    if (address(sherDistributionManager) == address(0)) return 0;
    // Does not allow restaking of 0 tokens
    if (_amount == 0) return 0;

    // Checks this amount of SHER tokens in this contract before we transfer new ones
    uint256 before = sher.balanceOf(address(this));

    // pullReward() calcs then actually transfers the SHER tokens to this contract
    // in case this call fails, whole (re)staking transaction fails
    _sher = sherDistributionManager.pullReward(_amount, _period, _id, _receiver);

    // actualAmount should represent the amount of SHER tokens transferred to this contract for the current stake position
    uint256 actualAmount = sher.balanceOf(address(this)) - before;
    if (actualAmount != _sher) revert InvalidSherAmount(_sher, actualAmount);
    // Assigns the newly created SHER tokens to the current stake position
    if (_sher != 0) sherRewards_[_id] = _sher;
  }

  // Checks to see if the NFT owner is the caller and that the position is unlockable
  function _verifyUnlockableByOwner(uint256 _id) internal view {
    if (ownerOf(_id) != msg.sender) revert Unauthorized();
    if (lockupEnd_[_id] > block.timestamp) revert InvalidConditions();
  }

  // Sends the SHER tokens associated with this NFT ID to the address of the NFT owner
  function _sendSherRewardsToOwner(uint256 _id, address _nftOwner) internal {
    uint256 sherReward = sherRewards_[_id];
    if (sherReward == 0) return;

    // Transfers the SHER tokens associated with this NFT ID to the address of the NFT owner
    sher.safeTransfer(_nftOwner, sherReward);
    // Deletes the SHER reward mapping for this NFT ID
    delete sherRewards_[_id];
  }

  // Transfers an amount of tokens to the receiver address
  // This is the logic for a payout AND for an unstake (used by the payoutClaim() function above and in _redeemShares() below)
  function _transferTokensOut(address _receiver, uint256 _amount) internal {
    // Transfers any premiums owed to stakers from the protocol manager to this contract
    sherlockProtocolManager.claimPremiumsForStakers();

    // The amount of tokens in this contract
    uint256 mainBalance = token.balanceOf(address(this));

    // If the amount to transfer out is still greater than the amount of tokens in this contract,
    // Withdraw yield strategy tokens to make up the difference
    if (_amount > mainBalance) {
      yieldStrategy.withdraw(_amount - mainBalance);
    }

    token.safeTransfer(_receiver, _amount);
  }

  // Returns the amount of USDC owed to this amount of stakeShares
  function _redeemSharesCalc(uint256 _stakeShares) internal view returns (uint256) {
    // Finds fraction that the given amount of stakeShares represents of the total
    // Then multiplies it by the total amount of tokens (USDC) owed to all stakers
    return (_stakeShares * totalTokenBalanceStakers()) / totalStakeShares;
  }

  // Transfers USDC to the receiver (arbitrager OR NFT owner) based on the stakeShares inputted
  // Also burns the requisite amount of shares associated with this NFT position
  // Returns the amount of USDC owed to these shares
  function _redeemShares(
    uint256 _id,
    uint256 _stakeShares,
    address _receiver
  ) internal returns (uint256 _amount) {
    // Returns the amount of USDC owed to this amount of stakeShares
    _amount = _redeemSharesCalc(_stakeShares);
    // Transfers _amount of tokens to _receiver address
    if (_amount != 0) _transferTokensOut(_receiver, _amount);

    // Subtracts this amount of stakeShares from the NFT position
    stakeShares[_id] -= _stakeShares;
    // Subtracts this amount of stakeShares from the total amount of stakeShares outstanding
    totalStakeShares -= _stakeShares;
  }

  // Helper function to restake an eligible NFT position on behalf of the NFT owner OR an arbitrager
  // Restakes an NFT position (_id) for a given period (_period) and
  // Sends any previously earned SHER rewards to the _nftOwner address
  function _restake(
    uint256 _id,
    uint256 _period,
    address _nftOwner
  ) internal returns (uint256 _sher) {
    // Sends the SHER tokens previously earned by this NFT ID to the address of the NFT owner
    // NOTE This function deletes the SHER reward mapping for this NFT ID
    _sendSherRewardsToOwner(_id, _nftOwner);

    // tokenBalanceOf() returns the USDC amount owed to this NFT ID
    // _stake() restakes that amount of USDC for the period inputted
    // We use the same ID that we just deleted the SHER rewards mapping for
    // Resets the lockupEnd mapping and SHER token rewards mapping for this ID
    // Note stakeShares for this position do not change so no need to update
    _sher = _stake(tokenBalanceOf(_id), _period, _id, _nftOwner);

    emit Restaked(_id);
  }

  // This function is called in the UI by anyone who is staking for the first time (not restaking a previous position)
  /// @notice Stakes `_amount` of tokens and locks up for `_period` seconds, `_receiver` will receive the NFT receipt
  /// @param _amount Amount of tokens to stake
  /// @param _period Period of time, in seconds, to lockup your funds
  /// @param _receiver Address that will receive the NFT representing the position
  /// @return _id ID of the position
  /// @return _sher Amount of SHER tokens to be released to this ID after `_period` ends
  /// @dev `_period` needs to be whitelisted
  function initialStake(
    uint256 _amount,
    uint256 _period,
    address _receiver
  ) external override whenNotPaused returns (uint256 _id, uint256 _sher) {
    if (_amount == 0) revert ZeroArgument();
    // Makes sure the period is a whitelisted period
    if (!stakingPeriods[_period]) revert InvalidArgument();
    if (address(_receiver) == address(0)) revert ZeroArgument();
    // Adds 1 to the ID of the last NFT created for the new NFT ID
    _id = ++nftCounter;

    // Transfers the USDC from the msg.sender to this contract for the amount specified (this is the staking action)
    token.safeTransferFrom(msg.sender, address(this), _amount);

    uint256 stakeShares_;
    uint256 totalStakeShares_ = totalStakeShares;
    // _amount of tokens divided by the "before" total amount of tokens, multiplied by the "before" amount of stake shares
    if (totalStakeShares_ != 0)
      stakeShares_ = (_amount * totalStakeShares_) / (totalTokenBalanceStakers() - _amount);
      // If this is the first stake ever, we just mint stake shares equal to the amount of USDC staked
    else stakeShares_ = _amount;

    // Assigns this NFT ID the calc'd amount of stake shares above
    stakeShares[_id] = stakeShares_;
    // Adds the newly created stake shares to the total amount of stake shares
    totalStakeShares += stakeShares_;

    // Locks up the USDC amount and calcs the SHER token amount to receive on unstake
    _sher = _stake(_amount, _period, _id, _receiver);

    // This is an ERC-721 function that creates an NFT and sends it to the receiver
    _safeMint(_receiver, _id);
  }

  // This is how a staker unstakes and cashes out on their position
  /// @notice Redeem NFT `_id` and receive `_amount` of tokens
  /// @param _id TokenID of the position
  /// @return _amount Amount of tokens (USDC) owed to NFT ID
  /// @dev Only the owner of `_id` will be able to redeem their position
  /// @dev The SHER rewards are sent to the NFT owner
  /// @dev Can only be called after lockup `_period` has ended
  function redeemNFT(uint256 _id) external override whenNotPaused returns (uint256 _amount) {
    // Checks to make sure caller is the owner of the NFT position, and that the lockup period is over
    _verifyUnlockableByOwner(_id);

    // This is the ERC-721 function to destroy an NFT (with owner's approval)
    _burn(_id);

    // Transfers USDC to the NFT owner based on the stake shares associated with this NFT ID
    // Also burns the requisite amount of shares associated with this NFT position
    // Returns the amount of USDC owed to these shares
    _amount = _redeemShares(_id, stakeShares[_id], msg.sender);

    // Sends the SHER tokens associated with this NFT ID to the NFT owner
    _sendSherRewardsToOwner(_id, msg.sender);

    // Removes the unlock deadline associated with this NFT
    delete lockupEnd_[_id];
  }

  // This is how a staker restakes an expired position
  /// @notice Owner restakes position with ID: `_id` for `_period` seconds
  /// @param _id ID of the position
  /// @param _period Period of time, in seconds, to lockup your funds
  /// @return _sher Amount of SHER tokens to be released to owner address after `_period` ends
  /// @dev Only the owner of `_id` will be able to restake their position using this call
  /// @dev `_period` needs to be whitelisted
  /// @dev Can only be called after lockup `_period` has ended
  function ownerRestake(uint256 _id, uint256 _period)
    external
    override
    whenNotPaused
    returns (uint256 _sher)
  {
    // Checks to make sure caller is the owner of the NFT position, and that the lockup period is over
    _verifyUnlockableByOwner(_id);

    // Checks to make sure the staking period is a whitelisted one
    if (!stakingPeriods[_period]) revert InvalidArgument();

    // Sends the previously earned SHER token rewards to the owner and restakes the USDC value of the position
    _sher = _restake(_id, _period, msg.sender);
  }

  // Calcs the reward (in stake shares) an arb would get for restaking a position
  // Takes the NFT ID as a param and outputs the stake shares (which can be redeemed for USDC) for the arb
  function _calcSharesForArbRestake(uint256 _id) internal view returns (uint256, bool) {
    // this is the first point at which an arb can restake a position (i.e. two weeks after the initial lockup ends)
    uint256 initialArbTime = lockupEnd_[_id] + ARB_RESTAKE_WAIT_TIME;

    // If the initialArbTime has not passed, return 0 for the stake shares and false for whether an arb can restake the position
    if (initialArbTime > block.timestamp) return (0, false);

    // The max rewards (as a % of the position's shares) for the arb are available at this timestamp
    uint256 maxRewardArbTime = initialArbTime + ARB_RESTAKE_GROWTH_TIME;

    // Caps the timestamp at the maxRewardArbTime so the calc below never goes above 100%
    uint256 targetTime = block.timestamp < maxRewardArbTime ? block.timestamp : maxRewardArbTime;

    // Scaled by 10**18
    // Represents the max amount of stake shares that an arb could get from restaking this position
    uint256 maxRewardScaled = ARB_RESTAKE_MAX_PERCENTAGE * stakeShares[_id];

    // Calcs what % of the max reward an arb gets based on the timestamp at which they call this function
    // If targetTime == maxRewardArbTime, then the arb gets 100% of the maxRewardScaled
    return (
      ((targetTime - initialArbTime) * maxRewardScaled) / (ARB_RESTAKE_GROWTH_TIME) / 10**18,
      true
    );
  }

  /// @notice Calculates the reward in tokens (USDC) that an arb would get for calling restake on a position
  /// @return profit How much profit an arb would make in USDC
  /// @return able If the transaction can be executed (the current timestamp is during an arb period, etc.)
  function viewRewardForArbRestake(uint256 _id) external view returns (uint256 profit, bool able) {
    // Returns the stake shares that an arb would get, and whether the position can currently be arbed
    // `profit` variable is used to store the amount of shares
    (profit, able) = _calcSharesForArbRestake(_id);
    // Calculates the tokens (USDC) represented by that amount of stake shares
    // Amount of shares stored in `profit` is used to calculate the reward in USDC, which is stored in `profit`
    profit = _redeemSharesCalc(profit);
  }

  /// @notice Allows someone who doesn't own the position (an arbitrager) to restake the position for 3 months (ARB_RESTAKE_PERIOD)
  /// @param _id ID of the position
  /// @return _sher Amount of SHER tokens to be released to position owner on expiry of the 3 month lockup
  /// @return _arbReward Amount of tokens (USDC) sent to caller (the arbitrager) in return for calling the function
  /// @dev Can only be called after lockup `_period` is more than 2 weeks in the past (assuming ARB_RESTAKE_WAIT_TIME is 2 weeks)
  /// @dev Max 20% (ARB_RESTAKE_MAX_PERCENTAGE) of tokens associated with a position are used to incentivize arbs (x)
  /// @dev During a 2 week period the reward ratio will move from 0% to 100% (* x)
  function arbRestake(uint256 _id)
    external
    override
    whenNotPaused
    returns (uint256 _sher, uint256 _arbReward)
  {
    address nftOwner = ownerOf(_id);

    // Returns the stake shares that an arb would get, and whether the position can currently be arbed
    (uint256 arbRewardShares, bool able) = _calcSharesForArbRestake(_id);
    // Revert if not able to be arbed
    if (!able) revert InvalidConditions();

    // Transfers USDC to the arbitrager based on the stake shares associated with the arb reward
    // Also burns the requisite amount of shares associated with this NFT position
    // Returns the amount of USDC paid to the arbitrager
    _arbReward = _redeemShares(_id, arbRewardShares, msg.sender);

    // Restakes the tokens (USDC) associated with this position for the ARB_RESTAKE PERIOD (3 months)
    // Sends previously earned SHER rewards to the NFT owner address
    _sher = _restake(_id, ARB_RESTAKE_PERIOD, nftOwner);

    emit ArbRestaked(_id, _arbReward);
  }
}
