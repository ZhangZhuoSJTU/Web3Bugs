// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './abstract/JBOperatable.sol';
import './interfaces/IJBDirectory.sol';
import './interfaces/IJBSplitsStore.sol';
import './libraries/JBConstants.sol';
import './libraries/JBOperations.sol';

/**
  @notice
  Stores splits for each project.

  @dev
  Adheres to -
  IJBSplitsStore: General interface for the methods in this contract that interact with the blockchain's state according to the protocol's rules.

  @dev
  Inherits from -
  JBOperatable: Includes convenience functionality for checking a message sender's permissions before executing certain transactions.
*/
contract JBSplitsStore is IJBSplitsStore, JBOperatable {
  //*********************************************************************//
  // --------------------------- custom errors ------------------------- //
  //*********************************************************************//
  error INVALID_LOCKED_UNTIL();
  error INVALID_PROJECT_ID();
  error INVALID_SPLIT_PERCENT();
  error INVALID_TOTAL_PERCENT();
  error PREVIOUS_LOCKED_SPLITS_NOT_INCLUDED();

  //*********************************************************************//
  // --------------------- private stored properties ------------------- //
  //*********************************************************************//

  /** 
    @notice
    The number of splits currently set for each project ID's configurations.

    _projectId The ID of the project to get the split count for.
    _domain An identifier within which the returned splits should be considered active.
    _group The identifying group of the splits.
  */
  mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256))) private _splitCountOf;

  /** 
    @notice
    Packed data of splits for each project ID's configurations.

    _projectId The ID of the project to get packed splits data for.
    _domain An identifier within which the returned splits should be considered active.
    _group The identifying group of the splits.
    _index The indexed order that the split was set at.
  */
  mapping(uint256 => mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256))))
    private _packedSplitParts1Of;

  /** 
    @notice
    More packed data of splits for each project ID's configurations.

    @dev
    This packed data is often 0.

    _projectId The ID of the project to get packed splits data for.
    _domain An identifier within which the returned splits should be considered active.
    _group The identifying group of the splits.
    _index The indexed order that the split was set at.
  */
  mapping(uint256 => mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256))))
    private _packedSplitParts2Of;

  //*********************************************************************//
  // ---------------- public immutable stored properties --------------- //
  //*********************************************************************//

  /** 
    @notice 
    Mints ERC-721's that represent project ownership and transfers.
  */
  IJBProjects public immutable override projects;

  /** 
    @notice 
    The directory of terminals and controllers for projects.
  */
  IJBDirectory public immutable override directory;

  //*********************************************************************//
  // ------------------------- external views -------------------------- //
  //*********************************************************************//

  /**
  @notice 
  Get all splits for the specified project ID, within the specified domain, for the specified group.

  @param _projectId The ID of the project to get splits for.
  @param _domain An identifier within which the returned splits should be considered active.
  @param _group The identifying group of the splits.

  @return An array of all splits for the project.
*/
  function splitsOf(
    uint256 _projectId,
    uint256 _domain,
    uint256 _group
  ) external view override returns (JBSplit[] memory) {
    return _getStructsFor(_projectId, _domain, _group);
  }

  //*********************************************************************//
  // -------------------------- constructor ---------------------------- //
  //*********************************************************************//

  /** 
    @param _operatorStore A contract storing operator assignments.
    @param _projects A contract which mints ERC-721's that represent project ownership and transfers.
    @param _directory A contract storing directories of terminals and controllers for each project.
  */
  constructor(
    IJBOperatorStore _operatorStore,
    IJBProjects _projects,
    IJBDirectory _directory
  ) JBOperatable(_operatorStore) {
    projects = _projects;
    directory = _directory;
  }

  //*********************************************************************//
  // ---------------------- external transactions ---------------------- //
  //*********************************************************************//

  /** 
    @notice 
    Sets a project's splits.

    @dev
    Only the owner or operator of a project, or the current controller contract of the project, can set its splits.

    @dev
    The new splits must include any currently set splits that are locked.

    @param _projectId The ID of the project for which splits are being added.
    @param _domain An identifier within which the splits should be considered active.
    @param _groupedSplits An array of splits to set for any number of groups. 
  */
  function set(
    uint256 _projectId,
    uint256 _domain,
    JBGroupedSplits[] calldata _groupedSplits
  )
    external
    override
    requirePermissionAllowingOverride(
      projects.ownerOf(_projectId),
      _projectId,
      JBOperations.SET_SPLITS,
      address(directory.controllerOf(_projectId)) == msg.sender
    )
  {
    // Push array length in stack
    uint256 _groupedSplitsLength = _groupedSplits.length;

    // Set each grouped splits.
    for (uint256 _i = 0; _i < _groupedSplitsLength; ) {
      // Get a reference to the grouped split being iterated on.
      JBGroupedSplits memory _groupedSplit = _groupedSplits[_i];

      // Set the splits for the group.
      _set(_projectId, _domain, _groupedSplit.group, _groupedSplit.splits);

      unchecked {
        ++_i;
      }
    }
  }

  //*********************************************************************//
  // --------------------- private helper functions -------------------- //
  //*********************************************************************//

  /** 
    @notice 
    Sets a project's splits.

    @dev
    The new splits must include any currently set splits that are locked.

    @param _projectId The ID of the project for which splits are being added.
    @param _domain An identifier within which the splits should be considered active.
    @param _group An identifier between of splits being set. All splits within this _group must add up to within 100%.
    @param _splits The splits to set.
  */
  function _set(
    uint256 _projectId,
    uint256 _domain,
    uint256 _group,
    JBSplit[] memory _splits
  ) internal {
    // Get a reference to the project's current splits.
    JBSplit[] memory _currentSplits = _getStructsFor(_projectId, _domain, _group);

    // Check to see if all locked splits are included.
    for (uint256 _i = 0; _i < _currentSplits.length; _i++) {
      // If not locked, continue.
      if (block.timestamp >= _currentSplits[_i].lockedUntil) continue;

      // Keep a reference to whether or not the locked split being iterated on is included.
      bool _includesLocked = false;

      for (uint256 _j = 0; _j < _splits.length; _j++) {
        // Check for sameness.
        if (
          _splits[_j].percent == _currentSplits[_i].percent &&
          _splits[_j].beneficiary == _currentSplits[_i].beneficiary &&
          _splits[_j].allocator == _currentSplits[_i].allocator &&
          _splits[_j].projectId == _currentSplits[_i].projectId &&
          // Allow lock extention.
          _splits[_j].lockedUntil >= _currentSplits[_i].lockedUntil
        ) _includesLocked = true;
      }

      if (!_includesLocked) revert PREVIOUS_LOCKED_SPLITS_NOT_INCLUDED();
    }

    // Add up all the percents to make sure they cumulative are under 100%.
    uint256 _percentTotal = 0;

    for (uint256 _i = 0; _i < _splits.length; _i++) {
      // The percent should be greater than 0.
      if (_splits[_i].percent == 0) revert INVALID_SPLIT_PERCENT();

      // ProjectId should be within a uint56
      if (_splits[_i].projectId > type(uint56).max) revert INVALID_PROJECT_ID();

      // Add to the total percents.
      _percentTotal = _percentTotal + _splits[_i].percent;

      // Validate the total does not exceed the expected value.
      if (_percentTotal > JBConstants.SPLITS_TOTAL_PERCENT) revert INVALID_TOTAL_PERCENT();

      uint256 _packedSplitParts1;

      // prefer claimed in bit 0.
      if (_splits[_i].preferClaimed) _packedSplitParts1 = 1;
      // prefer add to balance in bit 1.
      if (_splits[_i].preferAddToBalance) _packedSplitParts1 |= 1 << 1;
      // percent in bits 2-33.
      _packedSplitParts1 |= _splits[_i].percent << 2;
      // projectId in bits 32-89.
      _packedSplitParts1 |= _splits[_i].projectId << 34;
      // beneficiary in bits 90-249.
      _packedSplitParts1 |= uint256(uint160(address(_splits[_i].beneficiary))) << 90;

      // Store the first spit part.
      _packedSplitParts1Of[_projectId][_domain][_group][_i] = _packedSplitParts1;

      // If there's data to store in the second packed split part, pack and store.
      if (_splits[_i].lockedUntil > 0 || _splits[_i].allocator != IJBSplitAllocator(address(0))) {
        // Locked until should be within a uint48
        if (_splits[_i].lockedUntil > type(uint48).max) revert INVALID_LOCKED_UNTIL();

        // lockedUntil in bits 0-47.
        uint256 _packedSplitParts2 = uint48(_splits[_i].lockedUntil);
        // allocator in bits 48-207.
        _packedSplitParts2 |= uint256(uint160(address(_splits[_i].allocator))) << 48;

        // Store the second split part.
        _packedSplitParts2Of[_projectId][_domain][_group][_i] = _packedSplitParts2;

        // Otherwise if there's a value stored in the indexed position, delete it.
      } else if (_packedSplitParts2Of[_projectId][_domain][_group][_i] > 0)
        delete _packedSplitParts2Of[_projectId][_domain][_group][_i];

      emit SetSplit(_projectId, _domain, _group, _splits[_i], msg.sender);
    }

    // Set the new length of the splits.
    _splitCountOf[_projectId][_domain][_group] = _splits.length;
  }

  /**
    @notice 
    Unpack splits' packed stored values into easy-to-work-with spit structs.

    @param _projectId The ID of the project to which the split belongs.
    @param _domain The identifier within which the returned splits should be considered active.
    @param _group The identifying group of the splits.

    @return splits The split structs.
  */
  function _getStructsFor(
    uint256 _projectId,
    uint256 _domain,
    uint256 _group
  ) private view returns (JBSplit[] memory) {
    // Get a reference to the number of splits that need to be added to the returned array.
    uint256 _splitCount = _splitCountOf[_projectId][_domain][_group];

    // Initialize an array to be returned that has the set length.
    JBSplit[] memory _splits = new JBSplit[](_splitCount);

    // Loop through each split and unpack the values into structs.
    for (uint256 _i = 0; _i < _splitCount; _i++) {
      // Get a reference to the fist packed data.
      uint256 _packedSplitPart1 = _packedSplitParts1Of[_projectId][_domain][_group][_i];

      // Populate the split struct.
      JBSplit memory _split;

      // prefer claimed in bit 0.
      _split.preferClaimed = _packedSplitPart1 & 1 == 1;
      // prefer add to balance in bit 1.
      _split.preferAddToBalance = (_packedSplitPart1 >> 1) & 1 == 1;
      // percent in bits 2-33.
      _split.percent = uint256(uint32(_packedSplitPart1 >> 2));
      // projectId in bits 32-89.
      _split.projectId = uint256(uint56(_packedSplitPart1 >> 34));
      // beneficiary in bits 90-249.
      _split.beneficiary = payable(address(uint160(_packedSplitPart1 >> 90)));

      // Get a reference to the second packed data.
      uint256 _packedSplitPart2 = _packedSplitParts2Of[_projectId][_domain][_group][_i];

      // If there's anything in it, unpack.
      if (_packedSplitPart2 > 0) {
        // lockedUntil in bits 0-47.
        _split.lockedUntil = uint256(uint48(_packedSplitPart2));
        // allocator in bits 48-207.
        _split.allocator = IJBSplitAllocator(address(uint160(_packedSplitPart2 >> 48)));
      }

      // Add the split to the value being returned.
      _splits[_i] = _split;
    }

    return _splits;
  }
}
