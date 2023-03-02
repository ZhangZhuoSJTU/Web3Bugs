//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract MockERC20 is ERC20Permit {

    uint8 private _decimals;
    address private deployer;

    constructor(string memory _name, string memory _symbol, uint8 decimals_, address _initialAccount, uint256 _initialBalance) ERC20(_name, _symbol) ERC20Permit(_name) {
        _mint(_initialAccount, _initialBalance);
        _decimals = decimals_;
        deployer = msg.sender;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address _account, uint _amount) external {
        require(msg.sender == deployer);
        _mint(_account, _amount);
    }
}
