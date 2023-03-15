// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './abstract/JBControllerUtility.sol';
import './abstract/JBOperatable.sol';
import './interfaces/IJBTokenStore.sol';
import './libraries/JBOperations.sol';
import './JBToken.sol';

/**
  @notice
  Manage token minting, burning, and account balances.

  @dev
  Token balances can be either represented internally or claimed as ERC-20s into wallets.
  This contract manages these two representations and allows claiming.

  @dev
  The total supply of a project's tokens and the balance of each account are calculated in this contract.

  @dev
  Each project can bring their own token if they prefer, and swap between tokens at any time.
  
  @dev
  Adheres to -
  IJBTokenStore: General interface for the methods in this contract that interact with the blockchain's state according to the protocol's rules.

  @dev
  Inherits from -
  JBControllerUtility: Includes convenience functionality for checking if the message sender is the current controller of the project whose data is being manipulated.
  JBOperatable: Includes convenience functionality for checking a message sender's permissions before executing certain transactions.
*/
contract JBTokenStore is IJBTokenStore, JBControllerUtility, JBOperatable {
  //*********************************************************************//
  // --------------------------- custom errors ------------------------- //
  //*********************************************************************//
  error CANT_REMOVE_TOKEN_IF_ITS_REQUIRED();
  error EMPTY_NAME();
  error EMPTY_SYMBOL();
  error INSUFFICIENT_FUNDS();
  error INSUFFICIENT_UNCLAIMED_TOKENS();
  error PROJECT_ALREADY_HAS_TOKEN();
  error RECIPIENT_ZERO_ADDRESS();
  error TOKEN_ALREADY_IN_USE();
  error TOKEN_NOT_FOUND();
  error TOKENS_MUST_HAVE_18_DECIMALS();

  //*********************************************************************//
  // ---------------- public immutable stored properties --------------- //
  //*********************************************************************//

  /**
    @notice
    Mints ERC-721's that represent project ownership and transfers.
  */
  IJBProjects public immutable override projects;

  //*********************************************************************//
  // --------------------- public stored properties -------------------- //
  //*********************************************************************//

  /**
    @notice
    Each project's attached token contract.

    _projectId The ID of the project to which the token belongs.
  */
  mapping(uint256 => IJBToken) public override tokenOf;

  /**
    @notice
    The ID of the project that each token belongs to.

    _token The token to check the project association of.
  */
  mapping(IJBToken => uint256) public override projectOf;

  /**
    @notice
    The total supply of unclaimed tokens for each project.

    _projectId The ID of the project to which the token belongs.
  */
  mapping(uint256 => uint256) public override unclaimedTotalSupplyOf;

  /**
    @notice
    Each holder's balance of unclaimed tokens for each project.

    _holder The holder of balance.
    _projectId The ID of the project to which the token belongs.
  */
  mapping(address => mapping(uint256 => uint256)) public override unclaimedBalanceOf;

  /**
    @notice
    A flag indicating if tokens are required to be issued as claimed for a particular project.

    _projectId The ID of the project to which the requirement applies.
  */
  mapping(uint256 => bool) public override requireClaimFor;

  //*********************************************************************//
  // ------------------------- external views -------------------------- //
  //*********************************************************************//

  /**
    @notice
    The total supply of tokens for each project, including claimed and unclaimed tokens.

    @param _projectId The ID of the project to get the total token supply of.

    @return totalSupply The total supply of the project's tokens.
  */
  function totalSupplyOf(uint256 _projectId) external view override returns (uint256 totalSupply) {
    // Get a reference to the total supply of the project's unclaimed tokens.
    totalSupply = unclaimedTotalSupplyOf[_projectId];

    // Get a reference to the project's current token.
    IJBToken _token = tokenOf[_projectId];

    // If the project has a current token, add it's total supply to the total.
    if (_token != IJBToken(address(0))) totalSupply = totalSupply + _token.totalSupply(_projectId);
  }

  /**
    @notice
    The total balance of tokens a holder has for a specified project, including claimed and unclaimed tokens.

    @param _holder The token holder to get a balance for.
    @param _projectId The project to get the `_holder`s balance of.

    @return balance The project token balance of the `_holder
  */
  function balanceOf(address _holder, uint256 _projectId)
    external
    view
    override
    returns (uint256 balance)
  {
    // Get a reference to the holder's unclaimed balance for the project.
    balance = unclaimedBalanceOf[_holder][_projectId];

    // Get a reference to the project's current token.
    IJBToken _token = tokenOf[_projectId];

    // If the project has a current token, add the holder's balance to the total.
    if (_token != IJBToken(address(0))) balance = balance + _token.balanceOf(_holder, _projectId);
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
  ) JBOperatable(_operatorStore) JBControllerUtility(_directory) {
    projects = _projects;
  }

  //*********************************************************************//
  // ---------------------- external transactions ---------------------- //
  //*********************************************************************//

  /**
    @notice
    Issues a project's ERC-20 tokens that'll be used when claiming tokens.

    @dev
    Deploys a project's ERC-20 token contract.

    @dev
    Only a project's current controller can issue its token.

    @param _projectId The ID of the project being issued tokens.
    @param _name The ERC-20's name.
    @param _symbol The ERC-20's symbol.

    @return token The token that was issued.
  */
  function issueFor(
    uint256 _projectId,
    string calldata _name,
    string calldata _symbol
  ) external override onlyController(_projectId) returns (IJBToken token) {
    // There must be a name.
    if (bytes(_name).length == 0) revert EMPTY_NAME();

    // There must be a symbol.
    if (bytes(_symbol).length == 0) revert EMPTY_SYMBOL();

    // The project shouldn't already have a token.
    if (tokenOf[_projectId] != IJBToken(address(0))) revert PROJECT_ALREADY_HAS_TOKEN();

    // Deploy the token contract.
    token = new JBToken(_name, _symbol);

    // Store the token contract.
    tokenOf[_projectId] = token;

    // Store the project for the token.
    projectOf[token] = _projectId;

    emit Issue(_projectId, token, _name, _symbol, msg.sender);
  }

  /**
    @notice
    Swap the current project's token for another, and transfer ownership of the current token to another address if needed.

    @dev
    Only a project's current controller can change its token.

    @dev
    This contract must have access to all of the token's `IJBToken` interface functions.

    @dev
    Can't change to a token that's currently being used by another project.

    @dev
    Changing to the zero address will remove the current token without adding a new one.

    @param _projectId The ID of the project to which the changed token belongs.
    @param _token The new token. Send an empty address to remove the project's current token without adding a new one, if claiming tokens isn't currency required by the project
    @param _newOwner An address to transfer the current token's ownership to. This is optional, but it cannot be done later.

    @return oldToken The token that was removed as the project's token.
  */
  function changeFor(
    uint256 _projectId,
    IJBToken _token,
    address _newOwner
  ) external override onlyController(_projectId) returns (IJBToken oldToken) {
    // Can't remove the project's token if the project requires claiming tokens.
    if (_token == IJBToken(address(0)) && requireClaimFor[_projectId])
      revert CANT_REMOVE_TOKEN_IF_ITS_REQUIRED();

    // Can't change to a token already in use.
    if (projectOf[_token] != 0) revert TOKEN_ALREADY_IN_USE();

    // Can't change to a token that doesn't use 18 decimals.
    if (_token != IJBToken(address(0)) && _token.decimals() != 18)
      revert TOKENS_MUST_HAVE_18_DECIMALS();

    // Get a reference to the current token for the project.
    oldToken = tokenOf[_projectId];

    // Store the new token.
    tokenOf[_projectId] = _token;

    // Store the project for the new token if the new token isn't the zero address.
    if (_token != IJBToken(address(0))) projectOf[_token] = _projectId;

    // Reset the project for the old token if it isn't the zero address.
    if (oldToken != IJBToken(address(0))) projectOf[oldToken] = 0;

    // If there's a current token and a new owner was provided, transfer ownership of the old token to the new owner.
    if (_newOwner != address(0) && oldToken != IJBToken(address(0)))
      oldToken.transferOwnership(_projectId, _newOwner);

    emit Change(_projectId, _token, oldToken, _newOwner, msg.sender);
  }

  /**
    @notice
    Mint new project tokens.

    @dev
    Only a project's current controller can mint its tokens.

    @param _holder The address receiving the new tokens.
    @param _projectId The ID of the project to which the tokens belong.
    @param _amount The amount of tokens to mint.
    @param _preferClaimedTokens A flag indicating whether there's a preference for minted tokens to be claimed automatically into the `_holder`s wallet if the project currently has a token contract attached.
  */
  function mintFor(
    address _holder,
    uint256 _projectId,
    uint256 _amount,
    bool _preferClaimedTokens
  ) external override onlyController(_projectId) {
    // Get a reference to the project's current token.
    IJBToken _token = tokenOf[_projectId];

    // Save a reference to whether there exists a token and the caller prefers these claimed tokens or the project requires it.
    bool _shouldClaimTokens = (requireClaimFor[_projectId] || _preferClaimedTokens) &&
      _token != IJBToken(address(0));

    if (_shouldClaimTokens)
      // If tokens should be claimed, mint tokens into the holder's wallet.
      _token.mint(_projectId, _holder, _amount);
    else {
      // Otherwise, add the tokens to the unclaimed balance and total supply.
      unclaimedBalanceOf[_holder][_projectId] = unclaimedBalanceOf[_holder][_projectId] + _amount;
      unclaimedTotalSupplyOf[_projectId] = unclaimedTotalSupplyOf[_projectId] + _amount;
    }

    emit Mint(_holder, _projectId, _amount, _shouldClaimTokens, _preferClaimedTokens, msg.sender);
  }

  /**
    @notice
    Burns a project's tokens.

    @dev
    Only a project's current controller can burn its tokens.

    @param _holder The address that owns the tokens being burned.
    @param _projectId The ID of the project to which the burned tokens belong.
    @param _amount The amount of tokens to burn.
    @param _preferClaimedTokens A flag indicating whether there's a preference for tokens to burned from the `_holder`s wallet if the project currently has a token contract attached.
  */
  function burnFrom(
    address _holder,
    uint256 _projectId,
    uint256 _amount,
    bool _preferClaimedTokens
  ) external override onlyController(_projectId) {
    // Get a reference to the project's current token.
    IJBToken _token = tokenOf[_projectId];

    // Get a reference to the amount of unclaimed project tokens the holder has.
    uint256 _unclaimedBalance = unclaimedBalanceOf[_holder][_projectId];

    // Get a reference to the amount of the project's current token the holder has in their wallet.
    uint256 _claimedBalance = _token == IJBToken(address(0))
      ? 0
      : _token.balanceOf(_holder, _projectId);

    // There must be adequate tokens to burn across the holder's claimed and unclaimed balance.
    if (_amount > _claimedBalance + _unclaimedBalance) revert INSUFFICIENT_FUNDS();

    // The amount of tokens to burn.
    uint256 _claimedTokensToBurn;

    // If there's no balance, redeem no tokens.
    if (_claimedBalance == 0)
      _claimedTokensToBurn = 0;
      // If prefer converted, redeem tokens before redeeming unclaimed tokens.
    else if (_preferClaimedTokens)
      _claimedTokensToBurn = _claimedBalance < _amount ? _claimedBalance : _amount;
      // Otherwise, redeem unclaimed tokens before claimed tokens.
    else _claimedTokensToBurn = _unclaimedBalance < _amount ? _amount - _unclaimedBalance : 0;

    // The amount of unclaimed tokens to redeem.
    uint256 _unclaimedTokensToBurn = _amount - _claimedTokensToBurn;

    // Subtract the tokens from the unclaimed balance and total supply.
    if (_unclaimedTokensToBurn > 0) {
      // Reduce the holders balance and the total supply.
      unclaimedBalanceOf[_holder][_projectId] =
        unclaimedBalanceOf[_holder][_projectId] -
        _unclaimedTokensToBurn;
      unclaimedTotalSupplyOf[_projectId] =
        unclaimedTotalSupplyOf[_projectId] -
        _unclaimedTokensToBurn;
    }

    // Burn the claimed tokens.
    if (_claimedTokensToBurn > 0) _token.burn(_projectId, _holder, _claimedTokensToBurn);

    emit Burn(
      _holder,
      _projectId,
      _amount,
      _unclaimedBalance,
      _claimedBalance,
      _preferClaimedTokens,
      msg.sender
    );
  }

  /**
    @notice
    Claims internally accounted for tokens into a holder's wallet.

    @dev
    Only a token holder or an operator specified by the token holder can claim its unclaimed tokens.

    @param _holder The owner of the tokens being claimed.
    @param _projectId The ID of the project whose tokens are being claimed.
    @param _amount The amount of tokens to claim.
  */
  function claimFor(
    address _holder,
    uint256 _projectId,
    uint256 _amount
  ) external override requirePermission(_holder, _projectId, JBOperations.CLAIM) {
    // Get a reference to the project's current token.
    IJBToken _token = tokenOf[_projectId];

    // The project must have a token contract attached.
    if (_token == IJBToken(address(0))) revert TOKEN_NOT_FOUND();

    // Get a reference to the amount of unclaimed project tokens the holder has.
    uint256 _unclaimedBalance = unclaimedBalanceOf[_holder][_projectId];

    // There must be enough unclaimed tokens to claim.
    if (_unclaimedBalance < _amount) revert INSUFFICIENT_UNCLAIMED_TOKENS();

    // Subtract the claim amount from the holder's unclaimed project token balance.
    unclaimedBalanceOf[_holder][_projectId] = unclaimedBalanceOf[_holder][_projectId] - _amount;

    // Subtract the claim amount from the project's unclaimed total supply.
    unclaimedTotalSupplyOf[_projectId] = unclaimedTotalSupplyOf[_projectId] - _amount;

    // Mint the equivalent amount of the project's token for the holder.
    _token.mint(_projectId, _holder, _amount);

    emit Claim(_holder, _projectId, _unclaimedBalance, _amount, msg.sender);
  }

  /**
    @notice
    Allows a holder to transfer unclaimed tokens to another account.

    @dev
    Only a token holder or an operator can transfer its unclaimed tokens.

    @param _holder The address to transfer tokens from.
    @param _projectId The ID of the project whose tokens are being transferred.
    @param _recipient The recipient of the tokens.
    @param _amount The amount of tokens to transfer.
  */
  function transferFrom(
    address _holder,
    uint256 _projectId,
    address _recipient,
    uint256 _amount
  ) external override requirePermission(_holder, _projectId, JBOperations.TRANSFER) {
    // Can't transfer to the zero address.
    if (_recipient == address(0)) revert RECIPIENT_ZERO_ADDRESS();

    // Get a reference to the holder's unclaimed project token balance.
    uint256 _unclaimedBalance = unclaimedBalanceOf[_holder][_projectId];

    // The holder must have enough unclaimed tokens to transfer.
    if (_amount > _unclaimedBalance) revert INSUFFICIENT_UNCLAIMED_TOKENS();

    // Subtract from the holder's unclaimed token balance.
    unclaimedBalanceOf[_holder][_projectId] = unclaimedBalanceOf[_holder][_projectId] - _amount;

    // Add the unclaimed project tokens to the recipient's balance.
    unclaimedBalanceOf[_recipient][_projectId] =
      unclaimedBalanceOf[_recipient][_projectId] +
      _amount;

    emit Transfer(_holder, _projectId, _recipient, _amount, msg.sender);
  }

  /**
    @notice
    Allows a project to force all future mints of its tokens to be claimed into the holder's wallet, or revoke the flag if it's already set.

    @dev
    Only a token holder or an operator can require claimed token.

    @param _projectId The ID of the project being affected.
    @param _flag A flag indicating whether or not claiming should be required.
  */
  function shouldRequireClaimingFor(uint256 _projectId, bool _flag)
    external
    override
    requirePermission(projects.ownerOf(_projectId), _projectId, JBOperations.REQUIRE_CLAIM)
  {
    // Get a reference to the project's current token.
    IJBToken _token = tokenOf[_projectId];

    // The project must have a token contract attached.
    if (_token == IJBToken(address(0))) revert TOKEN_NOT_FOUND();

    // Store the flag.
    requireClaimFor[_projectId] = _flag;

    emit ShouldRequireClaim(_projectId, _flag, msg.sender);
  }
}
