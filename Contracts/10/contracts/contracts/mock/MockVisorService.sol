// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

import {IVisorService} from "../interfaces/IVisorService.sol";

contract MockVisorService is IVisorService {

  event SubscriberTokensReceived(address token, address operator, address from, address to, uint256 amount);
 
  constructor() {}

  function subscriberTokensReceived(
        address token,
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external override {
      emit SubscriberTokensReceived(token, operator, from, to, amount); 
    } 
}
