// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IERC20BurnFrom } from './interfaces/IERC20BurnFrom.sol';

import { ERC20 } from './ERC20.sol';
import { ERC20Permit } from './ERC20Permit.sol';
import { Ownable } from './Ownable.sol';

contract MintableCappedERC20 is ERC20, ERC20Permit, Ownable, IERC20BurnFrom {
    uint256 public cap;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 capacity
    ) ERC20(name, symbol, decimals) ERC20Permit(name) Ownable() {
        cap = capacity;
    }

    function mint(address account, uint256 amount) public onlyOwner {
        uint256 capacity = cap;
        require(capacity == 0 || totalSupply + amount <= capacity, 'CAP_EXCEEDED');

        _mint(account, amount);
    }

    // TODO move burnFrom into a separate BurnableERC20 contract
    function burnFrom(address account, uint256 amount) external onlyOwner {
        _approve(account, owner, allowance[account][owner] - amount);
        _burn(account, amount);
    }
}
