// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "../interfaces/IFethMarket.sol";

contract FETHMarketMock {
  IFethMarket public feth;

  receive() external payable {
    require(msg.sender == address(feth), "Only receive from FETH");
  }

  function setFeth(address _feth) public {
    feth = IFethMarket(_feth);
  }

  function marketLockupFor(address account, uint256 amount) public payable {
    feth.marketLockupFor{ value: msg.value }(account, amount);
  }

  function marketWithdrawLocked(
    address account,
    uint256 expiration,
    uint256 amount
  ) public {
    feth.marketWithdrawLocked(account, expiration, amount);
  }

  function marketWithdrawFrom(address account, uint256 amount) public {
    feth.marketWithdrawFrom(account, amount);
  }

  function marketUnlockFor(
    address account,
    uint256 expiration,
    uint256 amount
  ) public {
    feth.marketUnlockFor(account, expiration, amount);
  }

  function marketChangeLockup(
    address unlockFrom,
    uint256 unlockExpiration,
    uint256 unlockAmount,
    address depositFor,
    uint256 depositAmount
  ) external payable {
    feth.marketChangeLockup{ value: msg.value }(unlockFrom, unlockExpiration, unlockAmount, depositFor, depositAmount);
  }
}
