// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BUSD is ERC20 {
    // solhint-disable-next-line no-empty-blocks
    constructor() ERC20("BUSD Token", "BUSD") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
