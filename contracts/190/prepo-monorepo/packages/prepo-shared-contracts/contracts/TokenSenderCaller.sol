// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/ITokenSenderCaller.sol";
import "./interfaces/ITokenSender.sol";

contract TokenSenderCaller is ITokenSenderCaller {
  address internal _treasury;
  ITokenSender internal _tokenSender;

  function setTreasury(address treasury) public virtual override {
    _treasury = treasury;
    emit TreasuryChange(treasury);
  }

  function getTreasury() external view override returns (address) {
    return _treasury;
  }

  function setTokenSender(ITokenSender tokenSender) public virtual override {
    _tokenSender = tokenSender;
    emit TokenSenderChange(address(tokenSender));
  }

  function getTokenSender() external view override returns (ITokenSender) {
    return _tokenSender;
  }
}
