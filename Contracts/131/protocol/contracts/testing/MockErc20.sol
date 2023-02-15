// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockErc20 is ERC20 {
    uint8 internal _decimals;

    constructor(uint8 decimals_) ERC20("mock", "MOK") {
        _decimals = decimals_;
    }

    function mintFor(address account, uint256 amount) external returns (bool) {
        _mint(account, amount);
        return true;
    }

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    /**
     * @dev Uses same function name as `MintableForkToken` from Brownie-Token-Tester, which makes
     *      it cleaner in tests to use this both in fork and dev mode
     */
    // solhint-disable-next-line func-name-mixedcase
    function mint_for_testing(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
