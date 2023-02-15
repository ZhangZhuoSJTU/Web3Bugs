// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../LpToken.sol";

contract MockLpToken is LpToken {
    // solhint-disable-next-line func-name-mixedcase
    function mint_for_testing(address account, uint256 mintAmount) external {
        _mint(account, mintAmount);
    }
}
