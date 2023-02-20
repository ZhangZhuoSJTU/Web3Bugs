// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.6.12;

import "../Timelock.sol";

// Test timelock contract with admin helpers
contract TestTimelock is Timelock {
  constructor(address admin_, uint256 delay_) public Timelock(admin_, 2 days) {
    delay = delay_;
  }

  function harnessSetPendingAdmin(address pendingAdmin_) public {
    pendingAdmin = pendingAdmin_;
  }

  function harnessSetAdmin(address admin_) public {
    admin = admin_;
  }
}
