// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IPrePOMarket.sol";
import "./interfaces/IMarketHook.sol";
import "prepo-shared-contracts/contracts/AllowedMsgSenders.sol";
import "prepo-shared-contracts/contracts/AccountListCaller.sol";
import "prepo-shared-contracts/contracts/TokenSenderCaller.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract RedeemHook is IMarketHook, AllowedMsgSenders, AccountListCaller, TokenSenderCaller, SafeOwnable {
  /**
   * @dev Once a market has ended, users can directly settle their positions
   * with the market contract. Because users might call `redeem()`, a fee
   * might be taken and will be reimbursed using `_tokenSender`.
   */
  function hook(address sender, uint256 amountBeforeFee, uint256 amountAfterFee) external virtual override onlyAllowedMsgSenders {
    require(_accountList.isIncluded(sender), "redeemer not allowed");
    uint256 fee = amountBeforeFee - amountAfterFee;
    if (fee > 0) {
      IPrePOMarket(msg.sender).getCollateral().transferFrom(msg.sender, _treasury, fee);
      _tokenSender.send(sender, fee);
    }
  }

  function setAllowedMsgSenders(IAccountList allowedMsgSenders) public virtual override onlyOwner { super.setAllowedMsgSenders(allowedMsgSenders); }

  function setAccountList(IAccountList accountList) public virtual override onlyOwner { super.setAccountList(accountList); }

  function setTreasury(address _treasury) public override onlyOwner { super.setTreasury(_treasury); }

  function setTokenSender(ITokenSender tokenSender) public override onlyOwner { super.setTokenSender(tokenSender); }
}
