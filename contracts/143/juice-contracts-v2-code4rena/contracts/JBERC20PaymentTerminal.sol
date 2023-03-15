// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import './abstract/JBPayoutRedemptionPaymentTerminal.sol';

/** 
  @notice 
  Manages the inflows and outflows of an ERC-20 token.

  @dev
  Adheres to -
  IJBProjectPayer:  General interface for the methods in this contract that interact with the blockchain's state according to the protocol's rules.

  @dev
  Inherits from -
  JBPayoutRedemptionPaymentTerminal: Includes convenience functionality for checking a message sender's permissions before executing certain transactions.
*/
contract JBERC20PaymentTerminal is JBPayoutRedemptionPaymentTerminal {
  //*********************************************************************//
  // -------------------------- constructor ---------------------------- //
  //*********************************************************************//

  /**
    @param _token The token that this terminal manages.
    @param _currency The currency that this terminal's token adheres to for price feeds.
    @param _baseWeightCurrency The currency to base token issuance on.
    @param _payoutSplitsGroup The group that denotes payout splits from this terminal in the splits store.
    @param _operatorStore A contract storing operator assignments.
    @param _projects A contract which mints ERC-721's that represent project ownership and transfers.
    @param _directory A contract storing directories of terminals and controllers for each project.
    @param _splitsStore A contract that stores splits for each project.
    @param _prices A contract that exposes price feeds.
    @param _store A contract that stores the terminal's data.
    @param _owner The address that will own this contract.
  */
  constructor(
    IERC20Metadata _token,
    uint256 _currency,
    uint256 _baseWeightCurrency,
    uint256 _payoutSplitsGroup,
    IJBOperatorStore _operatorStore,
    IJBProjects _projects,
    IJBDirectory _directory,
    IJBSplitsStore _splitsStore,
    IJBPrices _prices,
    IJBSingleTokenPaymentTerminalStore _store,
    address _owner
  )
    JBPayoutRedemptionPaymentTerminal(
      address(_token),
      _token.decimals(),
      _currency,
      _baseWeightCurrency,
      _payoutSplitsGroup,
      _operatorStore,
      _projects,
      _directory,
      _splitsStore,
      _prices,
      _store,
      _owner
    )
  // solhint-disable-next-line no-empty-blocks
  {

  }

  //*********************************************************************//
  // ---------------------- internal transactions ---------------------- //
  //*********************************************************************//

  /** 
    @notice
    Transfers tokens.

    @param _from The address from which the transfer should originate.
    @param _to The address to which the transfer should go.
    @param _amount The amount of the transfer, as a fixed point number with the same number of decimals as this terminal.
  */
  function _transferFrom(
    address _from,
    address payable _to,
    uint256 _amount
  ) internal override {
    _from == address(this)
      ? IERC20(token).transfer(_to, _amount)
      : IERC20(token).transferFrom(_from, _to, _amount);
  }

  /** 
    @notice
    Logic to be triggered before transferring tokens from this terminal.

    @param _to The address to which the transfer is going.
    @param _amount The amount of the transfer, as a fixed point number with the same number of decimals as this terminal.
  */
  function _beforeTransferTo(address _to, uint256 _amount) internal override {
    IERC20(token).approve(_to, _amount);
  }
}
