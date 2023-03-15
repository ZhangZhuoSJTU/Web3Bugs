// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import '@paulrberg/contracts/math/PRBMath.sol';
import './abstract/JBControllerUtility.sol';
import './libraries/JBConstants.sol';

/** 
  @notice 
  Manages funding cycle configurations and scheduling.

  @dev
  Adheres to -
  IJBTokenStore: General interface for the methods in this contract that interact with the blockchain's state according to the protocol's rules.

  @dev
  Inherits from -
  JBControllerUtility: Includes convenience functionality for checking if the message sender is the current controller of the project whose data is being manipulated.
*/
contract JBFundingCycleStore is IJBFundingCycleStore, JBControllerUtility {
  //*********************************************************************//
  // --------------------------- custom errors ------------------------- //
  //*********************************************************************//
  error INVALID_DISCOUNT_RATE();
  error INVALID_DURATION();
  error INVALID_WEIGHT();
  error INVALID_BALLOT();
  error NO_SAME_BLOCK_RECONFIGURATION();

  //*********************************************************************//
  // --------------------- private stored properties ------------------- //
  //*********************************************************************//

  /** 
    @notice
    Stores the user defined properties of each funding cycle, packed into one storage slot.

    _projectId The ID of the project to get properties of.
    _configuration The funding cycle configuration to get properties of.
  */
  mapping(uint256 => mapping(uint256 => uint256)) private _packedUserPropertiesOf;

  /** 
    @notice
    Stores the properties added by the mechanism to manage and schedule each funding cycle, packed into one storage slot.
    
    _projectId The ID of the project to get instrinsic properties of.
    _configuration The funding cycle configuration to get properties of.
  */
  mapping(uint256 => mapping(uint256 => uint256)) private _packedIntrinsicPropertiesOf;

  /** 
    @notice
    Stores the metadata for each funding cycle configuration, packed into one storage slot.

    _projectId The ID of the project to get metadata of.
    _configuration The funding cycle configuration to get metadata of.
  */
  mapping(uint256 => mapping(uint256 => uint256)) private _metadataOf;

  //*********************************************************************//
  // --------------------- public stored properties -------------------- //
  //*********************************************************************//

  /** 
    @notice 
    The latest funding cycle configuration for each project.

    _projectId The ID of the project to get the latest funding cycle configuration of.
  */
  mapping(uint256 => uint256) public override latestConfigurationOf;

  //*********************************************************************//
  // ------------------------- external views -------------------------- //
  //*********************************************************************//

  /**
    @notice 
    Get the funding cycle with the given configuration for the specified project.

    @param _projectId The ID of the project to which the funding cycle belongs.
    @param _configuration The configuration of the funding cycle to get.

    @return fundingCycle The funding cycle.
  */
  function get(uint256 _projectId, uint256 _configuration)
    external
    view
    override
    returns (JBFundingCycle memory fundingCycle)
  {
    return _getStructFor(_projectId, _configuration);
  }

  /**
    @notice 
    The latest funding cycle to be configured for the specified project, and its current ballot state.

    @param _projectId The ID of the project to get the latest configured funding cycle of.

    @return fundingCycle The project's queued funding cycle.
    @return ballotState The state of the ballot for the reconfiguration.
  */
  function latestConfiguredOf(uint256 _projectId)
    external
    view
    override
    returns (JBFundingCycle memory fundingCycle, JBBallotState ballotState)
  {
    // Get a reference to the latest funding cycle configuration.
    uint256 _fundingCycleConfiguration = latestConfigurationOf[_projectId];

    // Resolve the funding cycle for the latest configuration.
    fundingCycle = _getStructFor(_projectId, _fundingCycleConfiguration);

    // Resolve the ballot state.
    ballotState = _ballotStateOf(
      _projectId,
      fundingCycle.configuration,
      fundingCycle.start,
      fundingCycle.basedOn
    );
  }

  /**
    @notice 
    The funding cycle that's next up for the specified project.

    @dev
    If a queued funding cycle of the project is not found, returns an empty funding cycle with all properties set to 0.

    @param _projectId The ID of the project to get the queued funding cycle of.

    @return fundingCycle The project's queued funding cycle.
  */
  function queuedOf(uint256 _projectId)
    external
    view
    override
    returns (JBFundingCycle memory fundingCycle)
  {
    // If the project does not have a funding cycle, return an empty struct.
    if (latestConfigurationOf[_projectId] == 0) return _getStructFor(0, 0);

    // Get a reference to the configuration of the standby funding cycle.
    uint256 _standbyFundingCycleConfiguration = _standbyOf(_projectId);

    // If it exists, return its funding cycle if it is approved.
    if (_standbyFundingCycleConfiguration > 0) {
      fundingCycle = _getStructFor(_projectId, _standbyFundingCycleConfiguration);

      if (_isApproved(_projectId, fundingCycle)) return fundingCycle;

      // Resolve the funding cycle for the latest configured funding cycle.
      fundingCycle = _getStructFor(_projectId, fundingCycle.basedOn);
    } else {
      // Resolve the funding cycle for the latest configured funding cycle.
      fundingCycle = _getStructFor(_projectId, latestConfigurationOf[_projectId]);

      // If the latest funding cycle starts in the future, it must start in the distant future
      // since its not in standby. In this case base the queued cycles on the base cycle.
      if (fundingCycle.start > block.timestamp)
        fundingCycle = _getStructFor(_projectId, fundingCycle.basedOn);
    }

    // There's no queued if the current has a duration of 0.
    if (fundingCycle.duration == 0) return _getStructFor(0, 0);

    // Check to see if this funding cycle's ballot is approved.
    // If so, return a funding cycle based on it.
    if (_isApproved(_projectId, fundingCycle)) return _mockFundingCycleBasedOn(fundingCycle, false);

    // Get the funding cycle of its base funding cycle, which carries the last approved configuration.
    fundingCycle = _getStructFor(_projectId, fundingCycle.basedOn);

    // There's no queued if the base, which must still be the current, has a duration of 0.
    if (fundingCycle.duration == 0) return _getStructFor(0, 0);

    // Return a mock of the next up funding cycle.
    return _mockFundingCycleBasedOn(fundingCycle, false);
  }

  /**
    @notice 
    The funding cycle that is currently active for the specified project.

    @dev
    If a current funding cycle of the project is not found, returns an empty funding cycle with all properties set to 0.

    @param _projectId The ID of the project to get the current funding cycle of.

    @return fundingCycle The project's current funding cycle.
  */
  function currentOf(uint256 _projectId)
    external
    view
    override
    returns (JBFundingCycle memory fundingCycle)
  {
    // If the project does not have a funding cycle, return an empty struct.
    if (latestConfigurationOf[_projectId] == 0) return _getStructFor(0, 0);

    // Get a reference to the configuration of the eligible funding cycle.
    uint256 _fundingCycleConfiguration = _eligibleOf(_projectId);

    // Keep a reference to the eligible funding cycle.
    JBFundingCycle memory _fundingCycle;

    // If an eligible funding cycle exists...
    if (_fundingCycleConfiguration > 0) {
      // Resolve the funding cycle for the eligible configuration.
      _fundingCycle = _getStructFor(_projectId, _fundingCycleConfiguration);

      // Check to see if this funding cycle's ballot is approved.
      // If so, return it.
      if (_isApproved(_projectId, _fundingCycle)) return _fundingCycle;

      // If it hasn't been approved, set the funding cycle configuration to be the configuration of the funding cycle that it's based on,
      // which carries the last approved configuration.
      _fundingCycleConfiguration = _fundingCycle.basedOn;
    } else {
      // No upcoming funding cycle found that is eligible to become active,
      // so use the last configuration.
      _fundingCycleConfiguration = latestConfigurationOf[_projectId];

      // Get the funding cycle for the latest ID.
      _fundingCycle = _getStructFor(_projectId, _fundingCycleConfiguration);

      // If it's not approved or if it hasn't yet started, get a reference to the funding cycle that the latest is based on, which has the latest approved configuration.
      if (!_isApproved(_projectId, _fundingCycle) || block.timestamp < _fundingCycle.start)
        _fundingCycleConfiguration = _fundingCycle.basedOn;
    }

    // If there is not funding cycle to base the current one on, there can't be a current one.
    if (_fundingCycleConfiguration == 0) return _getStructFor(0, 0);

    // The funding cycle to base a current one on.
    _fundingCycle = _getStructFor(_projectId, _fundingCycleConfiguration);

    // If the base has no duration, it's still the current one.
    if (_fundingCycle.duration == 0) return _fundingCycle;

    // Return a mock of the current funding cycle.
    return _mockFundingCycleBasedOn(_fundingCycle, true);
  }

  /** 
    @notice 
    The current ballot state of the project.

    @param _projectId The ID of the project to check the ballot state of.

    @return The project's current ballot's state.
  */
  function currentBallotStateOf(uint256 _projectId) external view override returns (JBBallotState) {
    // Get a reference to the latest funding cycle configuration.
    uint256 _fundingCycleConfiguration = latestConfigurationOf[_projectId];

    // Resolve the funding cycle for the latest configuration.
    JBFundingCycle memory _fundingCycle = _getStructFor(_projectId, _fundingCycleConfiguration);

    return
      _ballotStateOf(
        _projectId,
        _fundingCycle.configuration,
        _fundingCycle.start,
        _fundingCycle.basedOn
      );
  }

  //*********************************************************************//
  // -------------------------- constructor ---------------------------- //
  //*********************************************************************//

  /** 
    @param _directory A contract storing directories of terminals and controllers for each project.
  */
  // solhint-disable-next-line no-empty-blocks
  constructor(IJBDirectory _directory) JBControllerUtility(_directory) {}

  //*********************************************************************//
  // ---------------------- external transactions ---------------------- //
  //*********************************************************************//

  /**
    @notice 
    Configures the next eligible funding cycle for the specified project.

    @dev
    Only a project's current controller can configure its funding cycles.

    @param _projectId The ID of the project being configured.
    @param _data The funding cycle configuration data.
    @param _metadata Arbitrary extra data to associate with this funding cycle configuration that's not used within.
    @param _mustStartAtOrAfter The time before which the initialized funding cycle cannot start.

    @return The funding cycle that the configuration will take effect during.
  */
  function configureFor(
    uint256 _projectId,
    JBFundingCycleData calldata _data,
    uint256 _metadata,
    uint256 _mustStartAtOrAfter
  ) external override onlyController(_projectId) returns (JBFundingCycle memory) {
    // Duration must fit in a uint64.
    if (_data.duration > type(uint64).max) revert INVALID_DURATION();

    // Discount rate must be less than or equal to 100%.
    if (_data.discountRate > JBConstants.MAX_DISCOUNT_RATE) revert INVALID_DISCOUNT_RATE();

    // Weight must fit into a uint88.
    if (_data.weight > type(uint88).max) revert INVALID_WEIGHT();

    // Ballot should be a valid contract, supporting the correct interface
    if(_data.ballot != IJBFundingCycleBallot(address(0))) {

      address _ballot = address(_data.ballot);
      uint32 _size;
      assembly {
        _size := extcodesize(_ballot) // No contract at the address ?
      }
      if (_size == 0) revert INVALID_BALLOT();

      try _data.ballot.supportsInterface(type(IJBFundingCycleBallot).interfaceId) returns (bool _supports) {
        if(!_supports) revert INVALID_BALLOT(); // Contract exists at the address but with the wrong interface
      } catch {
        revert INVALID_BALLOT(); // No ERC165 support
      }
    }

    // The configuration timestamp is now.
    uint256 _configuration = block.timestamp;

    // Set up a reconfiguration by configuring intrinsic properties.
    _configureIntrinsicPropertiesFor(
      _projectId,
      _configuration,
      _data.weight,
      // Must start on or after the current timestamp.
      _mustStartAtOrAfter > block.timestamp ? _mustStartAtOrAfter : block.timestamp
    );

    // Efficiently stores a funding cycles provided user defined properties.
    // If all user config properties are zero, no need to store anything as the default value will have the same outcome.
    if (
      _data.ballot != IJBFundingCycleBallot(address(0)) ||
      _data.duration > 0 ||
      _data.discountRate > 0
    ) {
      // ballot in bits 0-159 bytes.
      uint256 packed = uint160(address(_data.ballot));

      // duration in bits 160-223 bytes.
      packed |= _data.duration << 160;

      // discountRate in bits 224-255 bytes.
      packed |= _data.discountRate << 224;

      // Set in storage.
      _packedUserPropertiesOf[_projectId][_configuration] = packed;
    }

    // Set the metadata if needed.
    if (_metadata > 0) _metadataOf[_projectId][_configuration] = _metadata;

    emit Configure(_configuration, _projectId, _data, _metadata, _mustStartAtOrAfter, msg.sender);

    // Return the funding cycle for the new configuration.
    return _getStructFor(_projectId, _configuration);
  }

  //*********************************************************************//
  // --------------------- private helper functions -------------------- //
  //*********************************************************************//

  /**
    @notice 
    Updates the configurable funding cycle for this project if it exists, otherwise creates one.

    @param _projectId The ID of the project to find a configurable funding cycle for.
    @param _configuration The time at which the funding cycle was configured.
    @param _weight The weight to store in the configured funding cycle.
    @param _mustStartAtOrAfter The time before which the initialized funding cycle can't start.
  */
  function _configureIntrinsicPropertiesFor(
    uint256 _projectId,
    uint256 _configuration,
    uint256 _weight,
    uint256 _mustStartAtOrAfter
  ) private {
    // If there's not yet a funding cycle for the project, initialize one.
    if (latestConfigurationOf[_projectId] == 0)
      // Use an empty funding cycle as the base.
      return
        _initFor(_projectId, _getStructFor(0, 0), _configuration, _mustStartAtOrAfter, _weight);

    // Get the active funding cycle's configuration.
    uint256 _currentConfiguration = _eligibleOf(_projectId);

    // If an eligible funding cycle does not exist, get a reference to the latest funding cycle configuration for the project.
    if (_currentConfiguration == 0)
      // Get the latest funding cycle's configuration.
      _currentConfiguration = latestConfigurationOf[_projectId];

    // Get a reference to the funding cycle.
    JBFundingCycle memory _baseFundingCycle = _getStructFor(_projectId, _currentConfiguration);

    if (!_isApproved(_projectId, _baseFundingCycle) || block.timestamp < _baseFundingCycle.start)
      // If it hasn't been approved or hasn't yet started, set the ID to be the funding cycle it's based on,
      // which carries the latest approved configuration.
      _baseFundingCycle = _getStructFor(_projectId, _baseFundingCycle.basedOn);

    // The configuration can't be the same as the base configuration.
    if (_baseFundingCycle.configuration == _configuration) revert NO_SAME_BLOCK_RECONFIGURATION();

    // The time after the ballot of the provided funding cycle has expired.
    // If the provided funding cycle has no ballot, return the current timestamp.
    uint256 _timestampAfterBallot = _baseFundingCycle.ballot == IJBFundingCycleBallot(address(0))
      ? 0
      : _configuration + _baseFundingCycle.ballot.duration();

    _initFor(
      _projectId,
      _baseFundingCycle,
      _configuration,
      // Can only start after the ballot.
      _timestampAfterBallot > _mustStartAtOrAfter ? _timestampAfterBallot : _mustStartAtOrAfter,
      _weight
    );
  }

  /**
    @notice 
    Initializes a funding cycle with the specified properties.

    @param _projectId The ID of the project to which the funding cycle being initialized belongs.
    @param _baseFundingCycle The funding cycle to base the initialized one on.
    @param _configuration The configuration of the funding cycle being initialized.
    @param _mustStartAtOrAfter The time before which the initialized funding cycle cannot start.
    @param _weight The weight to give the newly initialized funding cycle.
  */
  function _initFor(
    uint256 _projectId,
    JBFundingCycle memory _baseFundingCycle,
    uint256 _configuration,
    uint256 _mustStartAtOrAfter,
    uint256 _weight
  ) private {
    // If there is no base, initialize a first cycle.
    if (_baseFundingCycle.number == 0) {
      // The first number is 1.
      uint256 _number = 1;

      // Set fresh intrinsic properties.
      _packAndStoreIntrinsicPropertiesOf(
        _configuration,
        _projectId,
        _number,
        _weight,
        _baseFundingCycle.configuration,
        _mustStartAtOrAfter
      );
    } else {
      // Derive the correct next start time from the base.
      uint256 _start = _deriveStartFrom(_baseFundingCycle, _mustStartAtOrAfter);

      // A weight of 1 is treated as a weight of 0.
      // This is to allow a weight of 0 (default) to represent inheriting the discounted weight of the previous funding cycle.
      _weight = _weight > 0
        ? (_weight == 1 ? 0 : _weight)
        : _deriveWeightFrom(_baseFundingCycle, _start);

      // Derive the correct number.
      uint256 _number = _deriveNumberFrom(_baseFundingCycle, _start);

      // Update the intrinsic properties.
      _packAndStoreIntrinsicPropertiesOf(
        _configuration,
        _projectId,
        _number,
        _weight,
        _baseFundingCycle.configuration,
        _start
      );
    }

    // Set the project's latest funding cycle configuration.
    latestConfigurationOf[_projectId] = _configuration;

    emit Init(_configuration, _projectId, _baseFundingCycle.configuration);
  }

  /**
    @notice 
    Efficiently stores a funding cycle's provided intrinsic properties.

    @param _configuration The configuration of the funding cycle to pack and store.
    @param _projectId The ID of the project to which the funding cycle belongs.
    @param _number The number of the funding cycle.
    @param _weight The weight of the funding cycle.
    @param _basedOn The configuration of the base funding cycle.
    @param _start The start time of this funding cycle.
  */
  function _packAndStoreIntrinsicPropertiesOf(
    uint256 _configuration,
    uint256 _projectId,
    uint256 _number,
    uint256 _weight,
    uint256 _basedOn,
    uint256 _start
  ) private {
    // weight in bits 0-87.
    uint256 packed = _weight;

    // basedOn in bits 88-143.
    packed |= _basedOn << 88;

    // start in bits 144-199.
    packed |= _start << 144;

    // number in bits 200-255.
    packed |= _number << 200;

    // Store the packed value.
    _packedIntrinsicPropertiesOf[_projectId][_configuration] = packed;
  }

  /**
    @notice 
    The project's stored funding cycle that hasn't yet started and should be used next, if one exists.

    @dev
    A value of 0 is returned if no funding cycle was found.

    @dev
    Assumes the project has a latest configuration.
    
    @param _projectId The ID of a project to look through for a standby cycle.

    @return configuration The configuration of the standby funding cycle if one exists, or 0 if one doesn't exist.
  */
  function _standbyOf(uint256 _projectId) private view returns (uint256 configuration) {
    // Get a reference to the project's latest funding cycle.
    configuration = latestConfigurationOf[_projectId];

    // Get the necessary properties for the latest funding cycle.
    JBFundingCycle memory _fundingCycle = _getStructFor(_projectId, configuration);

    // There is no upcoming funding cycle if the latest funding cycle has already started.
    if (block.timestamp >= _fundingCycle.start) return 0;

    // If this is the first funding cycle, it is queued.
    if (_fundingCycle.number == 1) return configuration;

    // Get the necessary properties for the base funding cycle.
    JBFundingCycle memory _baseFundingCycle = _getStructFor(_projectId, _fundingCycle.basedOn);

    // If the latest configuration doesn't start until after another base cycle, return 0.
    if (
      _baseFundingCycle.duration > 0 &&
      block.timestamp < _fundingCycle.start - _baseFundingCycle.duration
    ) return 0;
  }

  /**
    @notice 
    The project's stored funding cycle that has started and hasn't yet expired.
    
    @dev
    A value of 0 is returned if no funding cycle was found.

    @dev
    Assumes the project has a latest configuration.

    @param _projectId The ID of the project to look through.

    @return configuration The configuration of an eligible funding cycle if one exists, or 0 if one doesn't exist.
  */
  function _eligibleOf(uint256 _projectId) private view returns (uint256 configuration) {
    // Get a reference to the project's latest funding cycle.
    configuration = latestConfigurationOf[_projectId];

    // Get the latest funding cycle.
    JBFundingCycle memory _fundingCycle = _getStructFor(_projectId, configuration);

    // If the latest is expired, return an empty funding cycle.
    // A duration of 0 cannot be expired.
    if (
      _fundingCycle.duration > 0 && block.timestamp >= _fundingCycle.start + _fundingCycle.duration
    ) return 0;

    // Return the funding cycle's configuration if it has started.
    if (block.timestamp >= _fundingCycle.start) return _fundingCycle.configuration;

    // Get a reference to the cycle's base configuration.
    JBFundingCycle memory _baseFundingCycle = _getStructFor(_projectId, _fundingCycle.basedOn);

    // If the base cycle isn't eligible, the project has no eligible cycle.
    // A duration of 0 is always eligible.
    if (
      _baseFundingCycle.duration > 0 &&
      block.timestamp >= _baseFundingCycle.start + _baseFundingCycle.duration
    ) return 0;

    // Return the configuration that the latest funding cycle is based on.
    configuration = _fundingCycle.basedOn;
  }

  /** 
    @notice 
    A view of the funding cycle that would be created based on the provided one if the project doesn't make a reconfiguration.

    @dev
    Returns an empty funding cycle if there can't be a mock funding cycle based on the provided one.

    @dev
    Assumes a funding cycle with a duration of 0 will never be asked to be the base of a mock.

    @param _baseFundingCycle The funding cycle that the resulting funding cycle should follow.
    @param _allowMidCycle A flag indicating if the mocked funding cycle is allowed to already be mid cycle.

    @return A mock of what the next funding cycle will be.
  */
  function _mockFundingCycleBasedOn(JBFundingCycle memory _baseFundingCycle, bool _allowMidCycle)
    private
    view
    returns (JBFundingCycle memory)
  {
    // Get the distance of the current time to the start of the next possible funding cycle.
    // If the returned mock cycle must not yet have started, the start time of the mock must be in the future.
    uint256 _mustStartAtOrAfter = !_allowMidCycle
      ? block.timestamp + 1
      : block.timestamp - _baseFundingCycle.duration + 1;

    // Derive what the start time should be.
    uint256 _start = _deriveStartFrom(_baseFundingCycle, _mustStartAtOrAfter);

    // Derive what the number should be.
    uint256 _number = _deriveNumberFrom(_baseFundingCycle, _start);

    return
      JBFundingCycle(
        _number,
        _baseFundingCycle.configuration,
        _baseFundingCycle.basedOn,
        _start,
        _baseFundingCycle.duration,
        _deriveWeightFrom(_baseFundingCycle, _start),
        _baseFundingCycle.discountRate,
        _baseFundingCycle.ballot,
        _baseFundingCycle.metadata
      );
  }

  /** 
    @notice 
    The date that is the nearest multiple of the specified funding cycle's duration from its end.

    @param _baseFundingCycle The funding cycle to base the calculation on.
    @param _mustStartAtOrAfter A date that the derived start must be on or come after.

    @return start The next start time.
  */
  function _deriveStartFrom(JBFundingCycle memory _baseFundingCycle, uint256 _mustStartAtOrAfter)
    private
    pure
    returns (uint256 start)
  {
    // A subsequent cycle to one with a duration of 0 should start as soon as possible.
    if (_baseFundingCycle.duration == 0) return _mustStartAtOrAfter;

    // The time when the funding cycle immediately after the specified funding cycle starts.
    uint256 _nextImmediateStart = _baseFundingCycle.start + _baseFundingCycle.duration;

    // If the next immediate start is now or in the future, return it.
    if (_nextImmediateStart >= _mustStartAtOrAfter) return _nextImmediateStart;

    // The amount of seconds since the `_mustStartAtOrAfter` time which results in a start time that might satisfy the specified constraints.
    uint256 _timeFromImmediateStartMultiple = (_mustStartAtOrAfter - _nextImmediateStart) %
      _baseFundingCycle.duration;

    // A reference to the first possible start timestamp.
    start = _mustStartAtOrAfter - _timeFromImmediateStartMultiple;

    // Add increments of duration as necessary to satisfy the threshold.
    while (_mustStartAtOrAfter > start) start = start + _baseFundingCycle.duration;
  }

  /** 
    @notice 
    The accumulated weight change since the specified funding cycle.

    @param _baseFundingCycle The funding cycle to base the calculation on.
    @param _start The start time of the funding cycle to derive a number for.

    @return weight The derived weight, as a fixed point number with 18 decimals.
  */
  function _deriveWeightFrom(JBFundingCycle memory _baseFundingCycle, uint256 _start)
    private
    pure
    returns (uint256 weight)
  {
    // A subsequent cycle to one with a duration of 0 should have the next possible weight.
    if (_baseFundingCycle.duration == 0)
      return
        PRBMath.mulDiv(
          _baseFundingCycle.weight,
          JBConstants.MAX_DISCOUNT_RATE - _baseFundingCycle.discountRate,
          JBConstants.MAX_DISCOUNT_RATE
        );

    // The weight should be based off the base funding cycle's weight.
    weight = _baseFundingCycle.weight;

    // If the discount is 0, the weight doesn't change.
    if (_baseFundingCycle.discountRate == 0) return weight;

    // The difference between the start of the base funding cycle and the proposed start.
    uint256 _startDistance = _start - _baseFundingCycle.start;

    // Apply the base funding cycle's discount rate for each cycle that has passed.
    uint256 _discountMultiple = _startDistance / _baseFundingCycle.duration;

    for (uint256 i = 0; i < _discountMultiple; i++) {
      // The number of times to apply the discount rate.
      // Base the new weight on the specified funding cycle's weight.
      weight = PRBMath.mulDiv(
        weight,
        JBConstants.MAX_DISCOUNT_RATE - _baseFundingCycle.discountRate,
        JBConstants.MAX_DISCOUNT_RATE
      );
      // The calculation doesn't need to continue if the weight is 0.
      if (weight == 0) break;
    }
  }

  /** 
    @notice 
    The number of the next funding cycle given the specified funding cycle.

    @param _baseFundingCycle The funding cycle to base the calculation on.
    @param _start The start time of the funding cycle to derive a number for.

    @return The funding cycle number.
  */
  function _deriveNumberFrom(JBFundingCycle memory _baseFundingCycle, uint256 _start)
    private
    pure
    returns (uint256)
  {
    // A subsequent cycle to one with a duration of 0 should be the next number.
    if (_baseFundingCycle.duration == 0) return _baseFundingCycle.number + 1;

    // The difference between the start of the base funding cycle and the proposed start.
    uint256 _startDistance = _start - _baseFundingCycle.start;

    // Find the number of base cycles that fit in the start distance.
    return _baseFundingCycle.number + (_startDistance / _baseFundingCycle.duration);
  }

  /** 
    @notice 
    Checks to see if the provided funding cycle is approved according to the correct ballot.

    @param _projectId The ID of the project to which the funding cycle belongs. 
    @param _fundingCycle The funding cycle to get an approval flag for.

    @return The approval flag.
  */
  function _isApproved(uint256 _projectId, JBFundingCycle memory _fundingCycle)
    private
    view
    returns (bool)
  {
    return
      _ballotStateOf(
        _projectId,
        _fundingCycle.configuration,
        _fundingCycle.start,
        _fundingCycle.basedOn
      ) == JBBallotState.Approved;
  }

  /**
    @notice 
    A project's latest funding cycle configuration approval status.

    @param _projectId The ID of the project to which the funding cycle belongs.
    @param _configuration The funding cycle configuration to get the ballot state of.
    @param _start The start time of the funding cycle configuration to get the ballot state of.
    @param _ballotFundingCycleConfiguration The configuration of the funding cycle which is configured with the ballot that should be used.

    @return The ballot state of the project.
  */
  function _ballotStateOf(
    uint256 _projectId,
    uint256 _configuration,
    uint256 _start,
    uint256 _ballotFundingCycleConfiguration
  ) private view returns (JBBallotState) {
    // If there is no ballot funding cycle, implicitly approve.
    if (_ballotFundingCycleConfiguration == 0) return JBBallotState.Approved;

    // Get the ballot funding cycle.
    JBFundingCycle memory _ballotFundingCycle = _getStructFor(
      _projectId,
      _ballotFundingCycleConfiguration
    );

    // If there is no ballot, the ID is auto approved.
    // Otherwise if the ballot's duration hasn't passed, its still active.
    // Otherwise, return the ballot's state.
    if (_ballotFundingCycle.ballot == IJBFundingCycleBallot(address(0)))
      return JBBallotState.Approved;
    else if (_ballotFundingCycle.ballot.duration() >= block.timestamp - _configuration)
      return JBBallotState.Active;
    else return _ballotFundingCycle.ballot.stateOf(_projectId, _configuration, _start);
  }

  /**
    @notice 
    Unpack a funding cycle's packed stored values into an easy-to-work-with funding cycle struct.

    @param _projectId The ID of the project to which the funding cycle belongs.
    @param _configuration The funding cycle configuration to get the full struct for.

    @return fundingCycle A funding cycle struct.
  */
  function _getStructFor(uint256 _projectId, uint256 _configuration)
    private
    view
    returns (JBFundingCycle memory fundingCycle)
  {
    // Return an empty funding cycle if the configuration specified is 0.
    if (_configuration == 0) return fundingCycle;

    fundingCycle.configuration = _configuration;

    uint256 _packedIntrinsicProperties = _packedIntrinsicPropertiesOf[_projectId][_configuration];

    // weight in bits 0-87 bits.
    fundingCycle.weight = uint256(uint88(_packedIntrinsicProperties));
    // basedOn in bits 88-143 bits.
    fundingCycle.basedOn = uint256(uint56(_packedIntrinsicProperties >> 88));
    // start in bits 144-199 bits.
    fundingCycle.start = uint256(uint56(_packedIntrinsicProperties >> 144));
    // number in bits 200-255 bits.
    fundingCycle.number = uint256(uint56(_packedIntrinsicProperties >> 200));

    uint256 _packedUserProperties = _packedUserPropertiesOf[_projectId][_configuration];

    // ballot in bits 0-159 bits.
    fundingCycle.ballot = IJBFundingCycleBallot(address(uint160(_packedUserProperties)));
    // duration in bits 160-223 bits.
    fundingCycle.duration = uint256(uint64(_packedUserProperties >> 160));
    // discountRate in bits 224-255 bits.
    fundingCycle.discountRate = uint256(uint32(_packedUserProperties >> 224));

    fundingCycle.metadata = _metadataOf[_projectId][_configuration];
  }
}
