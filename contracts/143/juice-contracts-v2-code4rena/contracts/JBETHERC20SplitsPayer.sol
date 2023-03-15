// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@paulrberg/contracts/math/PRBMath.sol';
import './interfaces/IJBSplitsPayer.sol';
import './interfaces/IJBSplitsStore.sol';
import './libraries/JBConstants.sol';
import './JBETHERC20ProjectPayer.sol';

/** 
  @notice 
  Sends ETH or ERC20's to a group of splits as it receives direct payments or has its functions called.

  @dev
  Inherit from this contract or borrow from its logic to forward ETH or ERC20's to a group of splits from within other contracts.

  @dev
  Adheres to -
  IJBSplitsPayer:  General interface for the methods in this contract that interact with the blockchain's state according to the protocol's rules.

  @dev
  Inherits from -
  JBETHERC20ProjectPayer: Sends ETH or ERC20's to a project treasury as it receives direct payments or has it's functions called.
  ReentrancyGuard: Contract module that helps prevent reentrant calls to a function.
*/
contract JBETHERC20SplitsPayer is IJBSplitsPayer, JBETHERC20ProjectPayer, ReentrancyGuard {
  //*********************************************************************//
  // ---------------- public immutable stored properties --------------- //
  //*********************************************************************//

  /**
    @notice
    The contract that stores splits for each project.
  */
  IJBSplitsStore public immutable override splitsStore;

  //*********************************************************************//
  // --------------------- public stored properties -------------------- //
  //*********************************************************************//

  /**
    @notice
    The ID of project for which the default splits are stored. 
  */
  uint256 public override defaultSplitsProjectId;

  /**
    @notice
    The domain within which the default splits are stored. 
  */
  uint256 public override defaultSplitsDomain;

  /**
    @notice
    The group within which the default splits are stored. 
  */
  uint256 public override defaultSplitsGroup;

  //*********************************************************************//
  // -------------------------- public views --------------------------- //
  //*********************************************************************//

  /**
    @notice
    Indicates if this contract adheres to the specified interface.

    @dev 
    See {IERC165-supportsInterface}.

    @param _interfaceId The ID of the interface to check for adherance to.

    @return A flag indicating if this contract adheres to the specified interface.
  */
  function supportsInterface(bytes4 _interfaceId)
    public
    view
    virtual
    override(JBETHERC20ProjectPayer, IERC165)
    returns (bool)
  {
    return
      _interfaceId == type(IJBSplitsPayer).interfaceId || super.supportsInterface(_interfaceId);
  }

  //*********************************************************************//
  // -------------------------- constructor ---------------------------- //
  //*********************************************************************//

  /** 
    @param _defaultSplitsProjectId The ID of project for which the default splits are stored.
    @param _defaultSplitsDomain The splits domain to payout when this contract receives direct payments.
    @param _defaultSplitsGroup The splits group to payout when this contract receives direct payments.
    @param _splitsStore A contract that stores splits for each project.
    @param _defaultProjectId The ID of the project whose treasury should be forwarded the splits payer contract's received payment leftovers after distributing to the default splits group.
    @param _defaultBeneficiary The address that'll receive the project's tokens. 
    @param _defaultPreferClaimedTokens A flag indicating whether issued tokens should be automatically claimed into the beneficiary's wallet. 
    @param _defaultMemo A memo to pass along to the emitted event, and passed along the the funding cycle's data source and delegate.  A data source can alter the memo before emitting in the event and forwarding to the delegate.
    @param _defaultMetadata Bytes to send along to the project's data source and delegate, if provided.
    @param _preferAddToBalance  A flag indicating if received payments should call the `pay` function or the `addToBalance` function of a project.
    @param _owner The address that will own the contract.
  */
  constructor(
    uint256 _defaultSplitsProjectId,
    uint256 _defaultSplitsDomain,
    uint256 _defaultSplitsGroup,
    IJBSplitsStore _splitsStore,
    uint256 _defaultProjectId,
    address payable _defaultBeneficiary,
    bool _defaultPreferClaimedTokens,
    string memory _defaultMemo,
    bytes memory _defaultMetadata,
    bool _preferAddToBalance,
    address _owner
  )
    JBETHERC20ProjectPayer(
      _defaultProjectId,
      _defaultBeneficiary,
      _defaultPreferClaimedTokens,
      _defaultMemo,
      _defaultMetadata,
      _preferAddToBalance,
      _splitsStore.directory(),
      _owner
    )
  {
    defaultSplitsProjectId = _defaultSplitsProjectId;
    defaultSplitsDomain = _defaultSplitsDomain;
    defaultSplitsGroup = _defaultSplitsGroup;
    splitsStore = _splitsStore;
  }

  //*********************************************************************//
  // ------------------------- default receive ------------------------- //
  //*********************************************************************//

  /** 
    @notice
    Received funds are paid to the default split group using the stored default properties.

    @dev
    This function is called automatically when the contract receives an ETH payment.
  */
  receive() external payable virtual override nonReentrant {
    // Pay the splits and get a reference to the amount leftover.
    uint256 _leftoverAmount = _payToSplits(
      defaultSplitsProjectId,
      defaultSplitsDomain,
      defaultSplitsGroup,
      JBTokens.ETH,
      address(this).balance,
      18, // decimals.
      defaultBeneficiary != address(0) ? defaultBeneficiary : msg.sender
    );

    // If there is no leftover amount, nothing left to pay.
    if (_leftoverAmount == 0) return;

    // If there's a default project ID, try to pay it.
    if (defaultProjectId != 0)
      if (defaultPreferAddToBalance)
        // Pay the project by adding to its balance if prefered.
        _addToBalanceOf(
          defaultProjectId,
          JBTokens.ETH,
          _leftoverAmount,
          18, // decimals.
          defaultMemo,
          defaultMetadata
        );
        // Otherwise, issue a payment to the project.
      else
        _pay(
          defaultProjectId,
          JBTokens.ETH,
          _leftoverAmount,
          18, // decimals.
          defaultBeneficiary != address(0) ? defaultBeneficiary : msg.sender,
          0, // min returned tokens.
          defaultPreferClaimedTokens,
          defaultMemo,
          defaultMetadata
        );
    // If no project was specified, send the funds directly to the beneficiary or the msg.sender.
    else
      Address.sendValue(
        defaultBeneficiary != address(0) ? payable(defaultBeneficiary) : payable(msg.sender),
        _leftoverAmount
      );
  }

  //*********************************************************************//
  // ---------------------- external transactions ---------------------- //
  //*********************************************************************//

  /** 
    @notice
    Sets the location of the splits that payments this contract receives will be split between.

    @param _projectId The ID of project for which the default splits are stored. 
    @param _domain The domain within which the default splits are stored. 
    @param _group The group within which the default splits are stored. 
  */
  function setDefaultSplits(
    uint256 _projectId,
    uint256 _domain,
    uint256 _group
  ) external virtual override onlyOwner {
    // Set the default splits project ID if it's changing.
    if (_projectId != defaultSplitsProjectId) defaultSplitsProjectId = _projectId;

    // Set the default splits domain if it's changing.
    if (_domain != defaultSplitsDomain) defaultSplitsDomain = _domain;

    // Set the default splits group if it's changing.
    if (_group != defaultSplitsGroup) defaultSplitsGroup = _group;

    emit SetDefaultSplits(_projectId, _domain, _group, msg.sender);
  }

  //*********************************************************************//
  // ----------------------- public transactions ----------------------- //
  //*********************************************************************//

  /** 
    @notice 
    Make a payment to the specified project after first splitting the amount among the stored default splits.

    @param _projectId The ID of the project that is being paid after.
    @param _token The token being paid in.
    @param _amount The amount of tokens being paid, as a fixed point number. If the token is ETH, this is ignored and msg.value is used in its place.
    @param _decimals The number of decimals in the `_amount` fixed point number. If the token is ETH, this is ignored and 18 is used in its place, which corresponds to the amount of decimals expected in msg.value.
    @param _beneficiary The address who will receive tokens from the payment made with leftover funds.
    @param _minReturnedTokens The minimum number of project tokens expected in return, as a fixed point number with 18 decimals.
    @param _preferClaimedTokens A flag indicating whether the request prefers to mint project tokens into the beneficiaries wallet rather than leaving them unclaimed. This is only possible if the project has an attached token contract. Leaving them unclaimed saves gas.
    @param _memo A memo to pass along to the emitted event, and passed along the the funding cycle's data source and delegate. A data source can alter the memo before emitting in the event and forwarding to the delegate.
    @param _metadata Bytes to send along to the data source, delegate, and emitted event, if provided.
  */
  function pay(
    uint256 _projectId,
    address _token,
    uint256 _amount,
    uint256 _decimals,
    address _beneficiary,
    uint256 _minReturnedTokens,
    bool _preferClaimedTokens,
    string calldata _memo,
    bytes calldata _metadata
  ) public payable virtual override nonReentrant {
    // ETH shouldn't be sent if the token isn't ETH.
    if (address(_token) != JBTokens.ETH) {
      if (msg.value > 0) revert NO_MSG_VALUE_ALLOWED();

      // Transfer tokens to this contract from the msg sender.
      IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    } else {
      // If ETH is being paid, set the amount to the message value, and decimals to 18.
      _amount = msg.value;
      _decimals = 18;
    }

    // Pay the splits and get a reference to the amount leftover.
    uint256 _leftoverAmount = _payToSplits(
      defaultSplitsProjectId,
      defaultSplitsDomain,
      defaultSplitsGroup,
      _token,
      _amount,
      _decimals,
      defaultBeneficiary != address(0) ? defaultBeneficiary : msg.sender
    );

    // Pay any leftover amount.
    if (_leftoverAmount > 0) {
      // If there's a default project ID, try to pay it.
      if (_projectId != 0) {
        _pay(
          _projectId,
          _token,
          _leftoverAmount,
          _decimals,
          _beneficiary != address(0) ? _beneficiary : msg.sender,
          _minReturnedTokens,
          _preferClaimedTokens,
          _memo,
          _metadata
        );
      }
      // If no project was specified, send the funds directly to the beneficiary or the msg.sender.
      else {
        // Transfer the ETH.
        if (_token == JBTokens.ETH)
          Address.sendValue(
            // If there's a beneficiary, send the funds directly to the beneficiary. Otherwise send to the msg.sender.
            _beneficiary != address(0) ? payable(_beneficiary) : payable(msg.sender),
            _leftoverAmount
          );
          // Or, transfer the ERC20.
        else
          IERC20(_token).transfer(
            // If there's a beneficiary, send the funds directly to the beneficiary. Otherwise send to the msg.sender.
            _beneficiary != address(0) ? _beneficiary : msg.sender,
            _leftoverAmount
          );
      }
    }

    emit Pay(
      _projectId,
      _beneficiary != address(0) ? defaultBeneficiary : msg.sender,
      _token,
      _amount,
      _decimals,
      _leftoverAmount,
      _minReturnedTokens,
      _preferClaimedTokens,
      _memo,
      _metadata,
      msg.sender
    );
  }

  /** 
    @notice 
    Add to the balance of the specified project after first splitting the amount among the stored default splits.

    @param _projectId The ID of the project that is being paid after.
    @param _token The token being paid in.
    @param _amount The amount of tokens being paid, as a fixed point number. If the token is ETH, this is ignored and msg.value is used in its place.
    @param _decimals The number of decimals in the `_amount` fixed point number. If the token is ETH, this is ignored and 18 is used in its place, which corresponds to the amount of decimals expected in msg.value.
    @param _memo A memo to pass along to the emitted event.  
    @param _metadata Extra data to pass along to the terminal.
  */
  function addToBalanceOf(
    uint256 _projectId,
    address _token,
    uint256 _amount,
    uint256 _decimals,
    string calldata _memo,
    bytes calldata _metadata
  ) public payable virtual override nonReentrant {
    // ETH shouldn't be sent if this terminal's token isn't ETH.
    if (address(_token) != JBTokens.ETH) {
      if (msg.value > 0) revert NO_MSG_VALUE_ALLOWED();

      // Transfer tokens to this contract from the msg sender.
      IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    } else {
      // If ETH is being paid, set the amount to the message value, and decimals to 18.
      _amount = msg.value;
      _decimals = 18;
    }

    // Pay the splits and get a reference to the amount leftover.
    uint256 _leftoverAmount = _payToSplits(
      defaultSplitsProjectId,
      defaultSplitsDomain,
      defaultSplitsGroup,
      _token,
      _amount,
      _decimals,
      defaultBeneficiary != address(0) ? defaultBeneficiary : msg.sender
    );

    // Distribute any leftover amount.
    if (_leftoverAmount > 0) {
      // If there's a default project ID, try to add to its balance.
      if (_projectId != 0)
        // Add to the project's balance.
        _addToBalanceOf(_projectId, _token, _leftoverAmount, _decimals, _memo, _metadata);

        // Otherwise, send a payment to the beneficiary.
      else {
        // Transfer the ETH.
        if (_token == JBTokens.ETH)
          Address.sendValue(
            // If there's a default beneficiary, send the funds directly to the beneficiary. Otherwise send to the msg.sender.
            defaultBeneficiary != address(0) ? defaultBeneficiary : payable(msg.sender),
            _leftoverAmount
          );
          // Or, transfer the ERC20.
        else
          IERC20(_token).transfer(
            // If there's a default beneficiary, send the funds directly to the beneficiary. Otherwise send to the msg.sender.
            defaultBeneficiary != address(0) ? defaultBeneficiary : msg.sender,
            _leftoverAmount
          );
      }
    }

    emit AddToBalance(
      _projectId,
      defaultBeneficiary != address(0) ? defaultBeneficiary : msg.sender,
      _token,
      _amount,
      _decimals,
      _leftoverAmount,
      _memo,
      _metadata,
      msg.sender
    );
  }

  //*********************************************************************//
  // ---------------------- internal transactions ---------------------- //
  //*********************************************************************//

  /** 
    @notice 
    Split an amount between all splits.

    @param _splitsProjectId The ID of the project to which the splits belong.
    @param _splitsDomain The splits domain to which the group belongs.
    @param _splitsGroup The splits group to pay.
    @param _token The token the amonut being split is in.
    @param _amount The amount of tokens being split, as a fixed point number. If the `_token` is ETH, this is ignored and msg.value is used in its place.
    @param _decimals The number of decimals in the `_amount` fixed point number. 
    @param _defaultBeneficiary The address that will benefit from any non-specified beneficiaries in splits.

    @return leftoverAmount The amount leftover after all splits were paid.
  */
  function _payToSplits(
    uint256 _splitsProjectId,
    uint256 _splitsDomain,
    uint256 _splitsGroup,
    address _token,
    uint256 _amount,
    uint256 _decimals,
    address _defaultBeneficiary
  ) internal virtual returns (uint256 leftoverAmount) {
    // Pay the splits.
    leftoverAmount = _payTo(
      splitsStore.splitsOf(_splitsProjectId, _splitsDomain, _splitsGroup),
      _token,
      _amount,
      _decimals,
      _defaultBeneficiary
    );
    emit DistributeToSplitGroup(_splitsProjectId, _splitsDomain, _splitsGroup, msg.sender);
  }

  /** 
    @notice 
    Split an amount between all splits.

    @param _splits The splits.
    @param _token The token the amonut being split is in.
    @param _amount The amount of tokens being split, as a fixed point number. If the `_token` is ETH, this is ignored and msg.value is used in its place.
    @param _decimals The number of decimals in the `_amount` fixed point number. 
    @param _defaultBeneficiary The address that will benefit from any non-specified beneficiaries in splits.

    @return leftoverAmount The amount leftover after all splits were paid.
  */
  function _payTo(
    JBSplit[] memory _splits,
    address _token,
    uint256 _amount,
    uint256 _decimals,
    address _defaultBeneficiary
  ) internal virtual returns (uint256 leftoverAmount) {
    // Set the leftover amount to the initial balance.
    leftoverAmount = _amount;

    // Settle between all splits.
    for (uint256 i = 0; i < _splits.length; i++) {
      // Get a reference to the split being iterated on.
      JBSplit memory _split = _splits[i];

      // The amount to send towards the split.
      uint256 _splitAmount = PRBMath.mulDiv(
        _amount,
        _split.percent,
        JBConstants.SPLITS_TOTAL_PERCENT
      );

      if (_splitAmount > 0) {
        // Transfer tokens to the split.
        // If there's an allocator set, transfer to its `allocate` function.
        if (_split.allocator != IJBSplitAllocator(address(0))) {
          // Create the data to send to the allocator.
          JBSplitAllocationData memory _data = JBSplitAllocationData(
            _token,
            _splitAmount,
            _decimals,
            defaultProjectId,
            0,
            _split
          );

          // Approve the `_amount` of tokens for the split allocator to transfer tokens from this contract.
          if (_token != JBTokens.ETH)
            IERC20(_token).approve(address(_split.allocator), _splitAmount);

          // If the token is ETH, send it in msg.value.
          uint256 _payableValue = _token == JBTokens.ETH ? _splitAmount : 0;

          // Trigger the allocator's `allocate` function.
          _split.allocator.allocate{value: _payableValue}(_data);

          // Otherwise, if a project is specified, make a payment to it.
        } else if (_split.projectId != 0) {
          if (_split.preferAddToBalance)
            _addToBalanceOf(
              _split.projectId,
              _token,
              _splitAmount,
              _decimals,
              defaultMemo,
              defaultMetadata
            );
          else
            _pay(
              _split.projectId,
              _token,
              _splitAmount,
              _decimals,
              _split.beneficiary != address(0) ? _split.beneficiary : _defaultBeneficiary,
              0,
              _split.preferClaimed,
              defaultMemo,
              defaultMetadata
            );
        } else {
          // Transfer the ETH.
          if (_token == JBTokens.ETH)
            Address.sendValue(
              // Get a reference to the address receiving the tokens. If there's a beneficiary, send the funds directly to the beneficiary. Otherwise send to _defaultBeneficiary.
              _split.beneficiary != address(0) ? _split.beneficiary : payable(_defaultBeneficiary),
              _splitAmount
            );
            // Or, transfer the ERC20.
          else {
            IERC20(_token).transfer(
              // Get a reference to the address receiving the tokens. If there's a beneficiary, send the funds directly to the beneficiary. Otherwise send to _defaultBeneficiary.
              _split.beneficiary != address(0) ? _split.beneficiary : _defaultBeneficiary,
              _splitAmount
            );
          }
        }

        // Subtract from the amount to be sent to the beneficiary.
        leftoverAmount = leftoverAmount - _splitAmount;
      }

      emit DistributeToSplit(_split, _splitAmount, _defaultBeneficiary, msg.sender);
    }
  }
}
