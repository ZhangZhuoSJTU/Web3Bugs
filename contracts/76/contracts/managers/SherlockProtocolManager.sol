// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './Manager.sol';
import '../interfaces/managers/ISherlockProtocolManager.sol';

/// @title Sherlock core interface for protocols
/// @author Evert Kors
// This is the contract that manages covered protocols

contract SherlockProtocolManager is ISherlockProtocolManager, Manager {
  using SafeERC20 for IERC20;

  // Represents the token that protocols pay with (currently USDC)
  IERC20 public immutable token;

  // This is the ceiling value that can be set for the threshold (based on USDC balance) at which a protocol can get removed
  uint256 public constant MIN_BALANCE_SANITY_CEILING = 30_000 * 10**6; // 30k usdc

  // A removed protocol is still able to make a claim for this amount of time after its removal
  uint256 public constant PROTOCOL_CLAIM_DEADLINE = 7 days;

  // This is the amount that cannot be withdrawn (measured in seconds of payment) if a protocol wants to remove active balance
  uint256 public constant MIN_SECONDS_LEFT = 7 days;

  // Convenient for percentage calculations
  uint256 internal constant HUNDRED_PERCENT = 10**18;

  // The minimum active "seconds of coverage left" a protocol must have before arbitragers can remove the protocol from coverage
  // This value is calculated from a protocol's active balance divided by the premium per second the protocol is paying
  uint256 public constant MIN_SECONDS_OF_COVERAGE = 12 hours;

  // This is an address that is controlled by a covered protocol (maybe its a multisig used by that protocol, etc.)
  mapping(bytes32 => address) internal protocolAgent_;

  // The percentage of premiums that is NOT sent to stakers (set aside for security experts, reinsurance partners, etc.)
  mapping(bytes32 => uint256) internal nonStakersPercentage;

  // The premium per second paid by each protocol is stored in this mapping
  mapping(bytes32 => uint256) internal premiums_;

  // Each protocol should keep an active balance (in USDC) which is drawn against to pay stakers, nonstakers, etc.
  // This "active balance" is really just an accounting concept, doesn't mean tokens have been transferred or not
  mapping(bytes32 => uint256) internal activeBalances;

  // The timestamp at which Sherlock last ran this internal accounting (on the active balance) for each protocol
  mapping(bytes32 => uint256) internal lastAccountedEachProtocol;

  // The amount that can be claimed by nonstakers for each protocol
  // We need this value so we can track how much payment is coming from each protocol
  mapping(bytes32 => uint256) internal nonStakersClaimableByProtocol;

  // The last time where the global accounting was run (to calc allPremiumsPerSecToStakers below)
  uint256 internal lastAccountedGlobal;

  // This is the total amount of premiums paid (per second) by all the covered protocols (added up)
  uint256 internal allPremiumsPerSecToStakers;

  // This is the amount that was claimable by stakers the last time the accounting was run
  // The claimable amount presumably changes every second so this value is marked "last" because it is usually out-of-date
  uint256 internal lastClaimablePremiumsForStakers;

  // The minimum active balance (measured in USDC) a protocol must keep before arbitragers can remove the protocol from coverage
  // This is one of two criteria a protocol must meet in order to avoid removal (the other is MIN_SECONDS_OF_COVERAGE)
  uint256 public override minActiveBalance;

  // Removed protocols can still make a claim up until this timestamp (will be 10 days or something)
  mapping(bytes32 => uint256) internal removedProtocolClaimDeadline;

  // Mapping to store the protocolAgents for removed protocols (useful for claims made by a removed protocol)
  mapping(bytes32 => address) internal removedProtocolAgent;

  // Current amount of coverage (i.e. 20M USDC) for a protocol
  mapping(bytes32 => uint256) internal currentCoverage;

  // Previous amount of coverage for a protocol
  // Previous is also tracked in case a protocol lowers their coverage amount but still needs to make a claim on the old, higher amount
  mapping(bytes32 => uint256) internal previousCoverage;

  // Setting the token to USDC
  constructor(IERC20 _token) {
    if (address(_token) == address(0)) revert ZeroArgument();
    token = _token;
  }

  // Modifier used to ensure a protocol exists (has been instantiated and not removed)
  modifier protocolExists(bytes32 _protocol) {
    _verifyProtocolExists(_protocol);
    _;
  }

  /// @notice View current protocolAgent of `_protocol`
  /// @param _protocol Protocol identifier
  /// @return Address able to submit claims
  function protocolAgent(bytes32 _protocol) external view override returns (address) {
    address agent = protocolAgent_[_protocol];
    if (agent != address(0)) return agent;

    // If a protocol has been removed but is still within the claim deadline, the protocolAgent is returned
    // Note: Old protocol agent will never be address(0)
    if (block.timestamp <= removedProtocolClaimDeadline[_protocol]) {
      return removedProtocolAgent[_protocol];
    }

    // If a protocol was never instantiated or was removed and the claim deadline has passed, this error is returned
    revert ProtocolNotExists(_protocol);
  }

  // Checks if the protocol exists, then returns the current premium per second being charged
  /// @notice View current premium of protocol
  /// @param _protocol Protocol identifier
  /// @return Amount of premium `_protocol` pays per second
  function premium(bytes32 _protocol)
    external
    view
    override
    protocolExists(_protocol)
    returns (uint256)
  {
    return premiums_[_protocol];
  }

  // Checks to see if a protocol has a protocolAgent assigned to it (we use this to check if a protocol exists)
  // If a protocol has been removed, it will throw an error here no matter what (even if still within claim window)
  function _verifyProtocolExists(bytes32 _protocol) internal view returns (address _protocolAgent) {
    _protocolAgent = protocolAgent_[_protocol];
    if (_protocolAgent == address(0)) revert ProtocolNotExists(_protocol);
  }

  //
  // View methods
  //

  // Calcs the debt accrued by the protocol since it last had an accounting update
  // This is the amount that needs to be removed from a protocol's active balance
  function _calcIncrementalProtocolDebt(bytes32 _protocol) internal view returns (uint256) {
    return (block.timestamp - lastAccountedEachProtocol[_protocol]) * premiums_[_protocol];
  }

  /// @notice View the amount nonstakers can claim from this protocol
  /// @param _protocol Protocol identifier
  /// @return Amount of tokens claimable by nonstakers
  /// @dev this reads from a storage variable + (now-lastsettled) * premiums
  // Note: This function works even for removed protocols because of nonStakersClaimableByProtocol[_protocol]
  // When a protocol gets removed, nonStakersClaimableByProtocol[_protocol] is updated and then doesn't change since the protocol has been removed
  function nonStakersClaimable(bytes32 _protocol) external view override returns (uint256) {
    // Calcs the debt of a protocol since the last accounting update
    uint256 debt = _calcIncrementalProtocolDebt(_protocol);
    // Gets the active balance of the protocol
    uint256 balance = activeBalances[_protocol];
    // The debt should never be higher than the balance (only happens if the arbitrages fail)
    if (debt > balance) debt = balance;

    // Adds the incremental claimable amount owed to nonstakers to the total claimable amount
    return
      nonStakersClaimableByProtocol[_protocol] +
      (nonStakersPercentage[_protocol] * debt) /
      HUNDRED_PERCENT;
  }

  /// @notice View current amount of all premiums that are owed to stakers
  /// @return Premiums claimable
  /// @dev Will increase every block
  /// @dev base + (now - last_settled) * ps
  function claimablePremiums() public view override returns (uint256) {
    // Takes last balance and adds (number of seconds since last accounting update * total premiums per second)
    return
      lastClaimablePremiumsForStakers +
      (block.timestamp - lastAccountedGlobal) *
      allPremiumsPerSecToStakers;
  }

  /// @notice View seconds of coverage left for `_protocol` before it runs out of active balance
  /// @param _protocol Protocol identifier
  /// @return Seconds of coverage left
  function secondsOfCoverageLeft(bytes32 _protocol)
    external
    view
    override
    protocolExists(_protocol)
    returns (uint256)
  {
    return _secondsOfCoverageLeft(_protocol);
  }

  // Helper function to return seconds of coverage left for a protocol
  // Gets the current active balance of the protocol and divides by the premium per second for the protocol
  function _secondsOfCoverageLeft(bytes32 _protocol) internal view returns (uint256) {
    uint256 premium = premiums_[_protocol];
    if (premium == 0) return 0;
    return _activeBalance(_protocol) / premium;
  }

  /// @notice View current active balance of covered protocol
  /// @param _protocol Protocol identifier
  /// @return Active balance
  /// @dev Accrued debt is subtracted from the stored active balance
  function activeBalance(bytes32 _protocol)
    external
    view
    override
    protocolExists(_protocol)
    returns (uint256)
  {
    return _activeBalance(_protocol);
  }

  // Helper function to calc the active balance of a protocol at current time
  function _activeBalance(bytes32 _protocol) internal view returns (uint256) {
    uint256 debt = _calcIncrementalProtocolDebt(_protocol);
    uint256 balance = activeBalances[_protocol];
    // The debt should never be higher than the balance (only happens if the arbitrages fail)
    if (debt > balance) return 0;
    return balance - debt;
  }

  //
  // State methods
  //

  /// @notice Helps set the premium per second for an individual protocol
  /// @param _protocol Protocol identifier
  /// @param _premium New premium per second
  /// @return oldPremiumPerSecond and nonStakerPercentage are returned for gas savings in the calling function
  function _setSingleProtocolPremium(bytes32 _protocol, uint256 _premium)
    internal
    returns (uint256 oldPremiumPerSecond, uint256 nonStakerPercentage)
  {
    // _settleProtocolDebt() subtracts debt from the protocol's active balance and updates the % due to nonstakers
    // Also updates the last accounted timestamp for this protocol
    // nonStakerPercentage is carried over from _settleProtocolDebt() for gas savings
    // nonStakerPercentage represents the percentage that goes to nonstakers for this protocol
    nonStakerPercentage = _settleProtocolDebt(_protocol);
    // Stores the old premium before it gets updated
    oldPremiumPerSecond = premiums_[_protocol];

    if (oldPremiumPerSecond != _premium) {
      // Sets the protocol's premium per second to the new value
      premiums_[_protocol] = _premium;
      emit ProtocolPremiumChanged(_protocol, oldPremiumPerSecond, _premium);
    }
    // We check if the NEW premium causes the _secondsOfCoverageLeft for the protocol to be less than the threshold for arbing
    // We don't need to check the min balance requirement for arbs because that value doesn't change like secondsOfCoverageLeft changes
    // Effectively we just need to make sure we don't accidentally run a protocol's active balance down below the point
    // Where arbs would no longer be incentivized to remove the protocol
    // Because if a protocol is not removed by arbs before running out of active balance, this can cause problems
    if (_premium != 0 && _secondsOfCoverageLeft(_protocol) < MIN_SECONDS_OF_COVERAGE) {
      revert InsufficientBalance(_protocol);
    }
  }

  /// @notice Sets a single protocol's premium per second and also updates the global total of premiums per second
  /// @param _protocol Protocol identifier
  /// @param _premium New premium per second
  function _setSingleAndGlobalProtocolPremium(bytes32 _protocol, uint256 _premium) internal {
    // Sets the individual protocol's premium and returns oldPremiumPerSecond and nonStakerPercentage for gas savings
    (uint256 oldPremiumPerSecond, uint256 nonStakerPercentage) = _setSingleProtocolPremium(
      _protocol,
      _premium
    );
    // Settling the total amount of premiums owed to stakers before a new premium per second gets set
    _settleTotalDebt();
    // This calculates the new global premium per second that gets paid to stakers
    // We input the same nonStakerPercentage twice because we simply aren't updating that value in this function
    allPremiumsPerSecToStakers = _calcGlobalPremiumPerSecForStakers(
      oldPremiumPerSecond,
      _premium,
      nonStakerPercentage,
      nonStakerPercentage,
      allPremiumsPerSecToStakers
    );
  }

  // Internal function to set a new protocolAgent for a specific protocol
  // _oldAgent is only included as part of emitting an event
  function _setProtocolAgent(
    bytes32 _protocol,
    address _oldAgent,
    address _protocolAgent
  ) internal {
    protocolAgent_[_protocol] = _protocolAgent;
    emit ProtocolAgentTransfer(_protocol, _oldAgent, _protocolAgent);
  }

  // Subtracts the accrued debt from a protocol's active balance
  // Credits the amount that can be claimed by nonstakers for this protocol
  // Takes the protocol ID as a param and returns the nonStakerPercentage for gas savings
  // Most of this function is dealing with an edge case related to a protocol not being removed by arbs
  function _settleProtocolDebt(bytes32 _protocol) internal returns (uint256 _nonStakerPercentage) {
    // This calcs the accrued debt of the protocol since it was last updated
    uint256 debt = _calcIncrementalProtocolDebt(_protocol);
    // This pulls the percentage that is sent to nonstakers
    _nonStakerPercentage = nonStakersPercentage[_protocol];
    // In case the protocol has accrued debt, this code block will ensure the debt is settled properly
    if (debt != 0) {
      // Pulls the stored active balance of the protocol
      uint256 balance = activeBalances[_protocol];
      // This is the start of handling an edge case where arbitragers don't remove this protocol before debt becomes greater than active balance
      // Economically speaking, this point should never be reached as arbs will get rewarded for removing the protocol before this point
      // The arb would use forceRemoveByActiveBalance and forceRemoveBySecondsOfCoverage
      // However, if arbs don't come in, the premium for this protocol should be set to 0 asap otherwise accounting for stakers/nonstakers gets messed up
      if (debt > balance) {
        // This error amount represents the magnitude of the mistake
        uint256 error = debt - balance;
        // Gets the latest value of claimable premiums for stakers
        _settleTotalDebt();
        // @note to production, set premium first to zero before solving accounting issue.
        // otherwise the accounting error keeps increasing
        uint256 lastClaimablePremiumsForStakers_ = lastClaimablePremiumsForStakers;

        // Figures out the amount due to stakers by subtracting the nonstaker percentage from 100%
        uint256 claimablePremiumError = ((HUNDRED_PERCENT - _nonStakerPercentage) * error) /
          HUNDRED_PERCENT;

        // This insufficient tokens var is simply how we know (emitted as an event) how many tokens the protocol is short
        uint256 insufficientTokens;

        // The idea here is that lastClaimablePremiumsForStakers has gotten too big accidentally
        // We need to decrease the balance of lastClaimablePremiumsForStakers by the amount that was added in error
        // This first line can be true if claimPremiumsForStakers() has been called and
        // lastClaimablePremiumsForStakers would be 0 but a faulty protocol could cause claimablePremiumError to be >0 still
        if (claimablePremiumError > lastClaimablePremiumsForStakers_) {
          insufficientTokens = claimablePremiumError - lastClaimablePremiumsForStakers_;
          lastClaimablePremiumsForStakers = 0;
        } else {
          // If the error is not bigger than the claimable premiums, then we just decrease claimable premiums
          // By the amount that was added in error (error) and insufficientTokens = 0
          lastClaimablePremiumsForStakers =
            lastClaimablePremiumsForStakers_ -
            claimablePremiumError;
        }

        // If two events are thrown, the values need to be summed up for the actual state.
        // This means an error of this type will continue until it is handled
        emit AccountingError(_protocol, claimablePremiumError, insufficientTokens);
        // We set the debt equal to the balance, and in the next line we effectively set the protocol's active balance to 0 in this case
        debt = balance;
      }
      // Subtracts the accrued debt (since last update) from the protocol's active balance and updates active balance
      activeBalances[_protocol] = balance - debt;
      // Adds the requisite amount of the debt to the balance claimable by nonstakers for this protocol
      nonStakersClaimableByProtocol[_protocol] += (_nonStakerPercentage * debt) / HUNDRED_PERCENT;
    }
    // Updates the last accounted timestamp for this protocol
    lastAccountedEachProtocol[_protocol] = block.timestamp;
  }

  // Multiplies the total premium per second * number of seconds since the last global accounting update
  // And adds it to the total claimable amount for stakers
  function _settleTotalDebt() internal {
    lastClaimablePremiumsForStakers +=
      (block.timestamp - lastAccountedGlobal) *
      allPremiumsPerSecToStakers;
    lastAccountedGlobal = block.timestamp;
  }

  // Calculates the global premium per second for stakers
  // Takes a specific protocol's old and new values for premium per second and nonstaker percentage and the old global premium per second to stakers
  // Subtracts out the old values of a protocol's premium per second and nonstaker percentage and adds the new ones
  function _calcGlobalPremiumPerSecForStakers(
    uint256 _premiumOld,
    uint256 _premiumNew,
    uint256 _nonStakerPercentageOld,
    uint256 _nonStakerPercentageNew,
    uint256 _inMemAllPremiumsPerSecToStakers
  ) internal pure returns (uint256) {
    return
      _inMemAllPremiumsPerSecToStakers +
      ((HUNDRED_PERCENT - _nonStakerPercentageNew) * _premiumNew) /
      HUNDRED_PERCENT -
      ((HUNDRED_PERCENT - _nonStakerPercentageOld) * _premiumOld) /
      HUNDRED_PERCENT;
  }

  // Helper function to remove and clean up a protocol from Sherlock
  // Params are the protocol ID and the protocol agent to which funds should be sent and from which post-removal claims can be made
  function _forceRemoveProtocol(bytes32 _protocol, address _agent) internal {
    // Sets the individual protocol's premium to zero and updates the global premium variable for a zero premium at this protocol
    _setSingleAndGlobalProtocolPremium(_protocol, 0);

    // Grabs the protocol's active balance
    uint256 balance = activeBalances[_protocol];

    // If there's still some active balance, delete the entry and send the remaining balance to the protocol agent
    if (balance != 0) {
      delete activeBalances[_protocol];
      token.safeTransfer(_agent, balance);

      emit ProtocolBalanceWithdrawn(_protocol, balance);
    }

    // Sets the protocol agent to zero address (as part of clean up)
    _setProtocolAgent(_protocol, _agent, address(0));

    // Cleans up other mappings for this protocol
    delete nonStakersPercentage[_protocol];
    delete lastAccountedEachProtocol[_protocol];
    // `premiums_` mapping is not deleted here as it's already 0 because of the `_setSingleAndGlobalProtocolPremium` call above

    // Sets a deadline in the future until which this protocol agent can still make claims for this removed protocol
    removedProtocolClaimDeadline[_protocol] = block.timestamp + PROTOCOL_CLAIM_DEADLINE;

    // This mapping allows Sherlock to verify the protocol agent making a claim after the protocol has been removed
    // Remember, only the protocol agent can make claims on behalf of the protocol, so this must be checked
    removedProtocolAgent[_protocol] = _agent;

    emit ProtocolUpdated(_protocol, bytes32(0), uint256(0), uint256(0));
    emit ProtocolRemoved(_protocol);
  }

  /// @notice Sets the minimum active balance before an arb can remove a protocol
  /// @param _minActiveBalance Minimum balance needed (in USDC)
  /// @dev Only gov
  function setMinActiveBalance(uint256 _minActiveBalance) external override onlyOwner {
    // New value cannot be the same as current value
    if (minActiveBalance == _minActiveBalance) revert InvalidArgument();
    // Can't set a value that is too high to be reasonable
    if (_minActiveBalance >= MIN_BALANCE_SANITY_CEILING) revert InvalidConditions();

    emit MinBalance(minActiveBalance, _minActiveBalance);
    minActiveBalance = _minActiveBalance;
  }

  // This function allows the nonstakers role to claim tokens owed to them by a specific protocol
  /// @notice Choose an `_amount` of tokens that nonstakers (`_receiver` address) will receive from `_protocol`
  /// @param _protocol Protocol identifier
  /// @param _amount Amount of tokens
  /// @param _receiver Address to receive tokens
  /// @dev Only callable by nonstakers role
  function nonStakersClaim(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver
  ) external override whenNotPaused {
    if (_protocol == bytes32(0)) revert ZeroArgument();
    if (_amount == uint256(0)) revert ZeroArgument();
    if (_receiver == address(0)) revert ZeroArgument();
    // Only the nonstakers role (multisig or contract) can pull the funds
    if (msg.sender != sherlockCore.nonStakersAddress()) revert Unauthorized();

    // Call can't be executed on protocol that is removed
    if (protocolAgent_[_protocol] != address(0)) {
      // Updates the amount that nonstakers can claim from this protocol
      _settleProtocolDebt(_protocol);
    }

    // Sets balance to the amount that is claimable by nonstakers for this specific protocol
    uint256 balance = nonStakersClaimableByProtocol[_protocol];
    // If the amount requested is more than what's owed to nonstakers, revert
    if (_amount > balance) revert InsufficientBalance(_protocol);

    // Sets the claimable amount to whatever is left over after this amount is pulled
    nonStakersClaimableByProtocol[_protocol] = balance - _amount;
    // Transfers the amount requested to the `_receiver` address
    token.safeTransfer(_receiver, _amount);
  }

  // Transfers funds owed to stakers from this contract to the Sherlock core contract (where we handle paying out stakers)
  /// @notice Transfer current claimable premiums (for stakers) to core Sherlock address
  /// @dev Callable by everyone
  /// @dev Funds will be transferred to Sherlock core contract
  function claimPremiumsForStakers() external override whenNotPaused {
    // Gets address of core Sherlock contract
    address sherlock = address(sherlockCore);
    // Revert if core Sherlock contract not initialized yet
    if (sherlock == address(0)) revert InvalidConditions();

    // claimablePremiums is different from _settleTotalDebt() because it does not change state
    // Retrieves current amount of all premiums that are owed to stakers
    uint256 amount = claimablePremiums();

    // Transfers all the premiums owed to stakers to the Sherlock core contract
    if (amount != 0) {
      // Global value of premiums owed to stakers is set to zero since we are transferring the entire amount out
      lastClaimablePremiumsForStakers = 0;
      lastAccountedGlobal = block.timestamp;
      token.safeTransfer(sherlock, amount);
    }
  }

  // Function is used in the SherlockClaimManager contract to decide if a proposed claim falls under either the current or previous coverage amounts
  /// @param _protocol Protocol identifier
  /// @return current and previous are the current and previous coverage amounts for this protocol
  // Note For this process to work, a protocol's coverage amount should not be set more than once in the span of claim delay period (7 days or something)
  function coverageAmounts(bytes32 _protocol)
    external
    view
    override
    returns (uint256 current, uint256 previous)
  {
    // Checks to see if the protocol has an active protocolAgent (protocol not removed)
    // OR checks to see if the removed protocol is still within the claim window
    // If so, gives the current and previous coverage, otherwise throws an error
    if (
      protocolAgent_[_protocol] != address(0) ||
      block.timestamp <= removedProtocolClaimDeadline[_protocol]
    ) {
      return (currentCoverage[_protocol], previousCoverage[_protocol]);
    }

    revert ProtocolNotExists(_protocol);
  }

  /// @notice Add a new protocol to Sherlock
  /// @param _protocol Protocol identifier
  /// @param _protocolAgent Address able to submit a claim on behalf of the protocol
  /// @param _coverage Hash referencing the active coverage agreement
  /// @param _nonStakers Percentage of premium payments to nonstakers, scaled by 10**18
  /// @param _coverageAmount Max amount claimable by this protocol
  /// @dev Adding a protocol allows the `_protocolAgent` to submit a claim
  /// @dev Coverage is not started yet as the protocol doesn't pay a premium at this point
  /// @dev `_nonStakers` is scaled by 10**18
  /// @dev Only callable by governance
  function protocolAdd(
    bytes32 _protocol,
    address _protocolAgent,
    bytes32 _coverage,
    uint256 _nonStakers,
    uint256 _coverageAmount
  ) external override onlyOwner {
    if (_protocol == bytes32(0)) revert ZeroArgument();
    if (_protocolAgent == address(0)) revert ZeroArgument();
    // Checks to make sure the protocol doesn't exist already
    if (protocolAgent_[_protocol] != address(0)) revert InvalidConditions();

    // Updates the protocol agent and passes in the old agent which is 0 address in this case
    _setProtocolAgent(_protocol, address(0), _protocolAgent);

    // Delete mappings that are potentially non default values
    // From previous time protocol was added/removed
    delete removedProtocolClaimDeadline[_protocol];
    delete removedProtocolAgent[_protocol];
    delete currentCoverage[_protocol];
    delete previousCoverage[_protocol];

    emit ProtocolAdded(_protocol);

    // Most of the logic for actually adding a protocol in this function
    protocolUpdate(_protocol, _coverage, _nonStakers, _coverageAmount);
  }

  /// @notice Update info regarding a protocol
  /// @param _protocol Protocol identifier
  /// @param _coverage Hash referencing the active coverage agreement
  /// @param _nonStakers Percentage of premium payments to nonstakers, scaled by 10**18
  /// @param _coverageAmount Max amount claimable by this protocol
  /// @dev Only callable by governance
  /// @dev `_nonStakers` can be 0
  function protocolUpdate(
    bytes32 _protocol,
    bytes32 _coverage,
    uint256 _nonStakers,
    uint256 _coverageAmount
  ) public override onlyOwner {
    if (_coverage == bytes32(0)) revert ZeroArgument();
    if (_nonStakers > HUNDRED_PERCENT) revert InvalidArgument();
    if (_coverageAmount == uint256(0)) revert ZeroArgument();

    // Checks to make sure the protocol has been assigned a protocol agent
    _verifyProtocolExists(_protocol);

    // Subtracts the accrued debt from a protocol's active balance (if any)
    // Updates the amount that can be claimed by nonstakers
    _settleProtocolDebt(_protocol);

    // Updates the global claimable amount for stakers
    _settleTotalDebt();

    // Gets the premium per second for this protocol
    uint256 premium = premiums_[_protocol];

    // Updates allPremiumsPerSecToStakers (premium is not able to be updated in this function, but percentage to nonstakers can be)
    allPremiumsPerSecToStakers = _calcGlobalPremiumPerSecForStakers(
      premium,
      premium,
      nonStakersPercentage[_protocol],
      _nonStakers,
      allPremiumsPerSecToStakers
    );

    // Updates the stored value of percentage of premiums that go to nonstakers
    nonStakersPercentage[_protocol] = _nonStakers;

    // Updates previous coverage and current coverage amounts
    previousCoverage[_protocol] = currentCoverage[_protocol];
    currentCoverage[_protocol] = _coverageAmount;

    emit ProtocolUpdated(_protocol, _coverage, _nonStakers, _coverageAmount);
  }

  /// @notice Remove a protocol from coverage
  /// @param _protocol Protocol identifier
  /// @dev Before removing a protocol the premium must be 0
  /// @dev Removing a protocol basically stops the `_protocolAgent` from being active (can still submit claims until claim deadline though)
  /// @dev Pays off debt + sends remaining balance to protocol agent
  /// @dev This call should be subject to a timelock
  /// @dev Only callable by governance
  function protocolRemove(bytes32 _protocol) external override onlyOwner {
    // checks to make sure the protocol actually has a protocol agent
    address agent = _verifyProtocolExists(_protocol);

    // Removes a protocol from Sherlock and cleans up its data
    // Params are the protocol ID and the protocol agent to which remaining active balance should be sent and from which post-removal claims can be made
    _forceRemoveProtocol(_protocol, agent);
  }

  /// @notice Remove a protocol with insufficient active balance
  /// @param _protocol Protocol identifier
  // msg.sender receives whatever is left of the insufficient active balance, this should incentivize arbs to call this function
  function forceRemoveByActiveBalance(bytes32 _protocol) external override whenNotPaused {
    address agent = _verifyProtocolExists(_protocol);

    // Gets the latest value of the active balance at this protocol
    _settleProtocolDebt(_protocol);
    // Sets latest value of active balance to remainingBalance variable
    uint256 remainingBalance = activeBalances[_protocol];

    // This means the protocol still has adequate active balance and thus cannot be removed
    if (remainingBalance >= minActiveBalance) revert InvalidConditions();

    // Sets the protocol's active balance to 0
    delete activeBalances[_protocol];
    // Removes the protocol from coverage
    _forceRemoveProtocol(_protocol, agent);

    if (remainingBalance != 0) {
      // sends the remaining balance to msg.sender
      token.safeTransfer(msg.sender, remainingBalance);
    }
    emit ProtocolRemovedByArb(_protocol, msg.sender, remainingBalance);
  }

  /// @notice Calculate if arb is possible and what the reward would be
  /// @param _protocol Protocol identifier
  /// @return arbAmount Amount reward for arbing
  /// @return able Indicator if arb call is even possible
  /// @dev Doesn't subtract the current protocol debt from the active balance
  function _calcForceRemoveBySecondsOfCoverage(bytes32 _protocol)
    internal
    view
    returns (uint256 arbAmount, bool able)
  {
    uint256 secondsLeft = _secondsOfCoverageLeft(_protocol);

    // If arb is not possible return false
    if (secondsLeft >= MIN_SECONDS_OF_COVERAGE) return (0, false);

    // This percentage scales over time
    // Reaches 100% on 0 seconds of coverage left
    uint256 percentageScaled = HUNDRED_PERCENT -
      (secondsLeft * HUNDRED_PERCENT) /
      MIN_SECONDS_OF_COVERAGE;

    able = true;
    arbAmount = (activeBalances[_protocol] * percentageScaled) / HUNDRED_PERCENT;
  }

  /// @notice Removes a protocol with insufficent seconds of coverage left
  /// @param _protocol Protocol identifier
  // Seconds of coverage is defined by the active balance of the protocol divided by the protocol's premium per second
  function forceRemoveBySecondsOfCoverage(bytes32 _protocol) external override whenNotPaused {
    // NOTE: We use _secondsOfCoverageLeft() below and include this check instead of secondsOfCoverageLeft() for gas savings
    address agent = _verifyProtocolExists(_protocol);

    // NOTE: We don't give the arb the full remaining balance like we do in forceRemoveByActiveBalance()
    // This is because we know the exact balance the arb will get in forceRemoveByActiveBalance()
    // But when removing based on seconds of coverage left, the remainingBalance could still be quite large
    // So it's better to scale the arb reward over time. It's a little complex because the remainingBalance
    // Decreases over time also but reward will be highest at the midpoint of percentageScaled (50%)
    _settleProtocolDebt(_protocol);
    (uint256 arbAmount, bool able) = _calcForceRemoveBySecondsOfCoverage(_protocol);
    if (able == false) revert InvalidConditions();

    if (arbAmount != 0) {
      // subtracts the amount that will be paid to the arb from the active balance
      activeBalances[_protocol] -= arbAmount;
    }

    // Removes the protocol from coverage
    // This function also pays the active balance to the protocol agent, so it's good we do this after subtracting arb amount above
    _forceRemoveProtocol(_protocol, agent);

    // Done after removing protocol to mitigate reentrency pattern
    // (In case token allows callback)
    if (arbAmount != 0) {
      token.safeTransfer(msg.sender, arbAmount);
    }
    emit ProtocolRemovedByArb(_protocol, msg.sender, arbAmount);
  }

  /// @notice Set premium of `_protocol` to `_premium`
  /// @param _protocol Protocol identifier
  /// @param _premium Amount of premium `_protocol` pays per second
  /// @dev The value 0 would mean inactive coverage
  /// @dev Only callable by governance
  function setProtocolPremium(bytes32 _protocol, uint256 _premium) external override onlyOwner {
    // Checks to see if protocol has a protocol agent
    _verifyProtocolExists(_protocol);

    // Updates individual protocol's premium and allPremiumsPerSecToStakers
    _setSingleAndGlobalProtocolPremium(_protocol, _premium);
  }

  /// @notice Set premium of multiple protocols
  /// @param _protocol Array of protocol identifiers
  /// @param _premium Array of premium amounts protocols pay per second
  /// @dev The value 0 would mean inactive coverage
  /// @dev Only callable by governance
  function setProtocolPremiums(bytes32[] calldata _protocol, uint256[] calldata _premium)
    external
    override
    onlyOwner
  {
    // Checks to make sure there are an equal amount of entries in each array
    if (_protocol.length != _premium.length) revert UnequalArrayLength();
    if (_protocol.length == 0) revert InvalidArgument();

    // Updates the global claimable amount for stakers
    _settleTotalDebt();

    uint256 allPremiumsPerSecToStakers_ = allPremiumsPerSecToStakers;

    // Loops through the array of protocols and checks to make sure each has a protocol agent assigned
    for (uint256 i; i < _protocol.length; i++) {
      _verifyProtocolExists(_protocol[i]);

      // Sets the protocol premium for that specific protocol
      // Function returns the old premium and nonStakerPercentage for that specific protocol
      (uint256 oldPremiumPerSecond, uint256 nonStakerPercentage) = _setSingleProtocolPremium(
        _protocol[i],
        _premium[i]
      );

      // Calculates the new global premium which adds up all premiums paid by all protocols
      allPremiumsPerSecToStakers_ = _calcGlobalPremiumPerSecForStakers(
        oldPremiumPerSecond,
        _premium[i],
        nonStakerPercentage,
        nonStakerPercentage,
        allPremiumsPerSecToStakers_
      );
    }

    // After the loop has finished, sets allPremiumsPerSecToStakers to the final temp value
    allPremiumsPerSecToStakers = allPremiumsPerSecToStakers_;
  }

  // This is how protocols pay for coverage by increasing their active balance
  /// @notice Deposits `_amount` of token to the active balance of `_protocol`
  /// @param _protocol Protocol identifier
  /// @param _amount Amount of tokens to deposit
  /// @dev Approval should be made before calling
  function depositToActiveBalance(bytes32 _protocol, uint256 _amount)
    external
    override
    whenNotPaused
  {
    if (_amount == uint256(0)) revert ZeroArgument();
    _verifyProtocolExists(_protocol);

    // Transfers _amount to this contract
    token.safeTransferFrom(msg.sender, address(this), _amount);
    // Increases the active balance of the protocol by _amount
    activeBalances[_protocol] += _amount;

    emit ProtocolBalanceDeposited(_protocol, _amount);
  }

  // If a protocol has paid too much into the active balance (which is how a protocol pays the premium)
  // Then the protocol can remove some of the active balance (up until there is 7 days worth of balance left)
  /// @notice Withdraws `_amount` of token from the active balance of `_protocol`
  /// @param _protocol Protocol identifier
  /// @param _amount Amount of tokens to withdraw
  /// @dev Only protocol agent is able to withdraw
  /// @dev Balance can be withdrawn up until 7 days worth of active balance
  function withdrawActiveBalance(bytes32 _protocol, uint256 _amount)
    external
    override
    whenNotPaused
  {
    if (_amount == uint256(0)) revert ZeroArgument();
    // Only the protocol agent can call this function
    if (msg.sender != _verifyProtocolExists(_protocol)) revert Unauthorized();

    // Updates the active balance of the protocol
    _settleProtocolDebt(_protocol);

    // Sets currentBalance to the active balance of the protocol
    uint256 currentBalance = activeBalances[_protocol];
    // Reverts if trying to withdraw more than the active balance
    if (_amount > currentBalance) revert InsufficientBalance(_protocol);

    // Removes the _amount to be withdrawn from the active balance
    activeBalances[_protocol] = currentBalance - _amount;
    // Reverts if a protocol has less than 7 days worth of active balance left
    if (_secondsOfCoverageLeft(_protocol) < MIN_SECONDS_LEFT) revert InsufficientBalance(_protocol);

    // Transfers the amount to the msg.sender (protocol agent)
    token.safeTransfer(msg.sender, _amount);
    emit ProtocolBalanceWithdrawn(_protocol, _amount);
  }

  /// @notice Transfer protocol agent role
  /// @param _protocol Protocol identifier
  /// @param _protocolAgent Account able to submit a claim on behalf of the protocol
  /// @dev Only the active protocolAgent is able to transfer the role
  function transferProtocolAgent(bytes32 _protocol, address _protocolAgent)
    external
    override
    whenNotPaused
  {
    if (_protocolAgent == address(0)) revert ZeroArgument();
    // Can't set the new protocol agent to the caller address
    if (msg.sender == _protocolAgent) revert InvalidArgument();
    // Because the caller must be the current protocol agent
    if (msg.sender != _verifyProtocolExists(_protocol)) revert Unauthorized();

    // Sets the protocol agent to the new address
    _setProtocolAgent(_protocol, msg.sender, _protocolAgent);
  }

  /// @notice Function used to check if this is the current active protocol manager
  /// @return Boolean indicating it's active
  /// @dev If inactive the owner can pull all ERC20s and ETH
  /// @dev Will be checked by calling the sherlock contract
  function isActive() public view returns (bool) {
    return address(sherlockCore.sherlockProtocolManager()) == address(this);
  }

  // Only contract owner can call this
  // Sends all specified tokens in this contract to the receiver's address (as well as ETH)
  function sweep(address _receiver, IERC20[] memory _extraTokens) external onlyOwner {
    if (_receiver == address(0)) revert ZeroArgument();
    // This contract must NOT be the current assigned protocol manager contract
    if (isActive()) revert InvalidConditions();
    // Executes the sweep for ERC-20s specified in _extraTokens as well as for ETH
    _sweep(_receiver, _extraTokens);
  }
}
