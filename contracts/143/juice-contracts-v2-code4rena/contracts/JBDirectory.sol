// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import '@openzeppelin/contracts/access/Ownable.sol';
import './abstract/JBOperatable.sol';
import './interfaces/IJBDirectory.sol';
import './libraries/JBGlobalFundingCycleMetadataResolver.sol';
import './libraries/JBOperations.sol';

/**
  @notice
  Keeps a reference of which terminal contracts each project is currently accepting funds through, and which controller contract is managing each project's tokens and funding cycles.

  @dev
  Adheres to -
  IJBDirectory: General interface for the methods in this contract that interact with the blockchain's state according to the protocol's rules.

  @dev
  Inherits from -
  JBOperatable: Includes convenience functionality for checking a message sender's permissions before executing certain transactions.
  Ownable: Includes convenience functionality for checking a message sender's permissions before executing certain transactions.
*/
contract JBDirectory is IJBDirectory, JBOperatable, Ownable {
  // A library that parses the packed funding cycle metadata into a friendlier format.
  using JBGlobalFundingCycleMetadataResolver for uint8;

  //*********************************************************************//
  // --------------------------- custom errors ------------------------- //
  //*********************************************************************//
  error DUPLICATE_TERMINALS();
  error INVALID_PROJECT_ID_IN_DIRECTORY();
  error SET_CONTROLLER_NOT_ALLOWED();
  error SET_TERMINALS_NOT_ALLOWED();
  error TOKEN_NOT_ACCEPTED();

  //*********************************************************************//
  // --------------------- private stored properties ------------------- //
  //*********************************************************************//

  /**
    @notice
    For each project ID, the terminals that are currently managing its funds.

    _projectId The ID of the project to get terminals of.
  */
  mapping(uint256 => IJBPaymentTerminal[]) private _terminalsOf;

  /**
    @notice
    The project's primary terminal for a token.

    _projectId The ID of the project to get the primary terminal of.
    _token The token to get the project's primary terminal of.
  */
  mapping(uint256 => mapping(address => IJBPaymentTerminal)) private _primaryTerminalOf;

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
    The contract storing all funding cycle configurations.
  */
  IJBFundingCycleStore public immutable override fundingCycleStore;

  //*********************************************************************//
  // --------------------- public stored properties -------------------- //
  //*********************************************************************//

  /** 
    @notice 
    For each project ID, the controller that manages how terminals interact with tokens and funding cycles.

    _projectId The ID of the project to get the controller of.
  */
  mapping(uint256 => address) public override controllerOf;

  /**
    @notice
    Addresses that can set a project's first controller on their behalf. These addresses/contracts have been vetted and verified by this contract's owner.

    _address The address that is either allowed or not.
  */
  mapping(address => bool) public override isAllowedToSetFirstController;

  //*********************************************************************//
  // ------------------------- external views -------------------------- //
  //*********************************************************************//

  /**
    @notice
    For each project ID, the terminals that are currently managing its funds.

    @param _projectId The ID of the project to get terminals of.

    @return An array of terminal addresses.
  */
  function terminalsOf(uint256 _projectId)
    external
    view
    override
    returns (IJBPaymentTerminal[] memory)
  {
    return _terminalsOf[_projectId];
  }

  /**
    @notice
    The primary terminal that is managing funds for a project for a specified token.

    @dev
    The zero address is returned if a terminal isn't found for the specified token.

    @param _projectId The ID of the project to get a terminal for.
    @param _token The token the terminal accepts.

    @return The primary terminal for the project for the specified token.
  */
  function primaryTerminalOf(uint256 _projectId, address _token)
    external
    view
    override
    returns (IJBPaymentTerminal)
  {
    // If a primary terminal for the token was specifically set and its one of the project's terminals, return it.
    if (
      _primaryTerminalOf[_projectId][_token] != IJBPaymentTerminal(address(0)) &&
      isTerminalOf(_projectId, _primaryTerminalOf[_projectId][_token])
    ) return _primaryTerminalOf[_projectId][_token];

    // Return the first terminal which accepts the specified token.
    for (uint256 _i; _i < _terminalsOf[_projectId].length; _i++) {
      IJBPaymentTerminal _terminal = _terminalsOf[_projectId][_i];
      if (_terminal.acceptsToken(_token, _projectId)) return _terminal;
    }

    // Not found.
    return IJBPaymentTerminal(address(0));
  }

  //*********************************************************************//
  // -------------------------- public views --------------------------- //
  //*********************************************************************//

  /**
    @notice
    Whether or not a specified terminal is a terminal of the specified project.

    @param _projectId The ID of the project to check within.
    @param _terminal The address of the terminal to check for.

    @return A flag indicating whether or not the specified terminal is a terminal of the specified project.
  */
  function isTerminalOf(uint256 _projectId, IJBPaymentTerminal _terminal)
    public
    view
    override
    returns (bool)
  {
    for (uint256 _i; _i < _terminalsOf[_projectId].length; _i++)
      if (_terminalsOf[_projectId][_i] == _terminal) return true;
    return false;
  }

  //*********************************************************************//
  // -------------------------- constructor ---------------------------- //
  //*********************************************************************//

  /**
    @param _operatorStore A contract storing operator assignments.
    @param _projects A contract which mints ERC-721's that represent project ownership and transfers.
    @param _fundingCycleStore A contract storing all funding cycle configurations.
    @param _owner The address that will own the contract.
  */
  constructor(
    IJBOperatorStore _operatorStore,
    IJBProjects _projects,
    IJBFundingCycleStore _fundingCycleStore,
    address _owner
  ) JBOperatable(_operatorStore) {
    projects = _projects;
    fundingCycleStore = _fundingCycleStore;

    _transferOwnership(_owner);
  }

  //*********************************************************************//
  // ---------------------- external transactions ---------------------- //
  //*********************************************************************//

  /**
    @notice
    Update the controller that manages how terminals interact with the ecosystem.

    @dev
    A controller can be set if:
    - the message sender is the project owner or an operator having the correct authorization.
    - the message sender is the project's current controller.
    - or, an allowedlisted address is setting a controller for a project that doesn't already have a controller.

    @param _projectId The ID of the project to set a new controller for.
    @param _controller The new controller to set.
  */
  function setControllerOf(uint256 _projectId, address _controller)
    external
    override
    requirePermissionAllowingOverride(
      projects.ownerOf(_projectId),
      _projectId,
      JBOperations.SET_CONTROLLER,
      (msg.sender == address(controllerOf[_projectId]) ||
        (isAllowedToSetFirstController[msg.sender] && controllerOf[_projectId] == address(0)))
    )
  {
    // The project must exist.
    if (projects.count() < _projectId) revert INVALID_PROJECT_ID_IN_DIRECTORY();

    // Get a reference to the project's current funding cycle.
    JBFundingCycle memory _fundingCycle = fundingCycleStore.currentOf(_projectId);

    // Setting controller is allowed if called from the current controller, or if the project doesn't have a current controller, or if the project's funding cycle allows setting the controller. Revert otherwise.
    if (
      msg.sender != address(controllerOf[_projectId]) &&
      controllerOf[_projectId] != address(0) &&
      !uint8(_fundingCycle.metadata >> 8).setControllerAllowed()
    ) revert SET_CONTROLLER_NOT_ALLOWED();

    // Set the new controller.
    controllerOf[_projectId] = _controller;

    emit SetController(_projectId, _controller, msg.sender);
  }

  /** 
    @notice 
    Set a project's terminals.

    @dev
    Only a project owner, an operator, or its controller can set its terminals.

    @param _projectId The ID of the project having terminals set.
    @param _terminals The terminal to set.
  */
  function setTerminalsOf(uint256 _projectId, IJBPaymentTerminal[] calldata _terminals)
    external
    override
    requirePermissionAllowingOverride(
      projects.ownerOf(_projectId),
      _projectId,
      JBOperations.SET_TERMINALS,
      msg.sender == address(controllerOf[_projectId])
    )
  {
    // Get a reference to the project's current funding cycle.
    JBFundingCycle memory _fundingCycle = fundingCycleStore.currentOf(_projectId);

    // Setting terminals must be allowed if not called from the current controller.
    if (
      msg.sender != address(controllerOf[_projectId]) &&
      !uint8(_fundingCycle.metadata >> 8).setTerminalsAllowed()
    ) revert SET_TERMINALS_NOT_ALLOWED();

    // Delete the stored terminals for the project.
    _terminalsOf[_projectId] = _terminals;

    // Make sure duplicates were not added.
    if (_terminals.length > 1)
      for (uint256 _i; _i < _terminals.length; _i++)
        for (uint256 _j = _i + 1; _j < _terminals.length; _j++)
          if (_terminals[_i] == _terminals[_j]) revert DUPLICATE_TERMINALS();

    emit SetTerminals(_projectId, _terminals, msg.sender);
  }

  /**
    @notice
    Project's can set which terminal should be their primary for a particular token.
    This is useful in case a project has several terminals connected for a particular token.

    @dev
    The terminal will be set as the primary terminal where ecosystem contracts should route tokens.

    @dev
    If setting a newly added terminal and the funding cycle doesn't allow new terminals, the caller must be the current controller.

    @param _projectId The ID of the project for which a primary token is being set.
    @param _token The token to set the primary terminal of.
    @param _terminal The terminal to make primary.
  */
  function setPrimaryTerminalOf(
    uint256 _projectId,
    address _token,
    IJBPaymentTerminal _terminal
  )
    external
    override
    requirePermission(projects.ownerOf(_projectId), _projectId, JBOperations.SET_PRIMARY_TERMINAL)
  {
    // Can't set the primary terminal for a token if it doesn't accept the token.
    if (!_terminal.acceptsToken(_token, _projectId)) revert TOKEN_NOT_ACCEPTED();

    // Add the terminal to the project if it hasn't been already.
    _addTerminalIfNeeded(_projectId, _terminal);

    // Store the terminal as the primary for the particular token.
    _primaryTerminalOf[_projectId][_token] = _terminal;

    emit SetPrimaryTerminal(_projectId, _token, _terminal, msg.sender);
  }

  /** 
    @notice	
    Set a contract to the list of trusted addresses that can set a first controller for any project.	

    @dev
    The owner can add addresses which are allowed to change projects' first controllers. 
    These addresses are known and vetted controllers as well as contracts designed to launch new projects. 
    A project can set its own controller without it being on the allow list.

    @dev
    If you would like an address/contract allowlisted, please reach out to the contract owner.

    @param _address The address to allow or revoke allowance from.
    @param _flag Whether allowance is being added or revoked.
  */
  function setIsAllowedToSetFirstController(address _address, bool _flag)
    external
    override
    onlyOwner
  {
    // Set the flag in the allowlist.
    isAllowedToSetFirstController[_address] = _flag;

    emit SetIsAllowedToSetFirstController(_address, _flag, msg.sender);
  }

  //*********************************************************************//
  // --------------------- private helper functions -------------------- //
  //*********************************************************************//

  /**
    @notice
    Add a terminal to a project's list of terminals if it hasn't been already.

    @param _projectId The ID of the project having a terminal added.
    @param _terminal The terminal to add.
  */
  function _addTerminalIfNeeded(uint256 _projectId, IJBPaymentTerminal _terminal) private {
    // Check that the terminal has not already been added.
    if (isTerminalOf(_projectId, _terminal)) return;

    // Get a reference to the project's current funding cycle.
    JBFundingCycle memory _fundingCycle = fundingCycleStore.currentOf(_projectId);

    // Setting terminals must be allowed if not called from the current controller.
    if (
      msg.sender != address(controllerOf[_projectId]) &&
      !uint8(_fundingCycle.metadata >> 8).setTerminalsAllowed()
    ) revert SET_TERMINALS_NOT_ALLOWED();

    // Add the new terminal.
    _terminalsOf[_projectId].push(_terminal);

    emit AddTerminal(_projectId, _terminal, msg.sender);
  }
}
