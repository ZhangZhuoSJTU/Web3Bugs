// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/ERC20Upgradeable.sol";

// Author: @0xKiwi_

contract DummyXToken is ERC20Upgradeable {
    constructor() {
        __ERC20_init("AMOGUS", "AMOGUS");
    }

    function burnFrom(address account, uint256 amount) public virtual {
      uint256 _allowance = allowance(account, msg.sender);
      require(amount<=_allowance, "No allowance for burn");
      uint256 decreasedAllowance = _allowance - amount;

      _approve(account, _msgSender(), decreasedAllowance);
      _burn(account, amount);
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
