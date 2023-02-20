// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract MockToken is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply,
        address _owner
    ) Ownable() ERC20(name, symbol) {
        _setupDecimals(decimals_);
        _mint(_owner, initialSupply);
        Ownable.transferOwnership(_owner);
    }

    function mint(address _to, uint256 _amount) external onlyOwner {
        require(_amount != 0, 'Token::burn: invalid amount');
        _mint(_to, _amount);
    }

    function approve(address _spender, uint256 _amount) public override returns (bool) {
        // copied from USDT contract
        // https://etherscan.io/address/0xdac17f958d2ee523a2206206994597c13d831ec7#code
        require(!((_amount != 0) && (allowance(msg.sender, _spender) != 0)), 'MT:A1');
        return super.approve(_spender, _amount);
    }
}
