// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISett} from "../interfaces/ISett.sol";

contract Sett is ERC20, ISett {
    IERC20 token;

    constructor(IERC20 _token) public ERC20("Sett", "sett") {
        token = _token;
    }

    function deposit(uint256 _amount) override external {
        token.transferFrom(msg.sender, address(this), _amount);
        _mint(msg.sender, _amount);
    }

    function withdraw(uint256 _shares) override external {
        _burn(msg.sender, _shares);
        token.transfer(msg.sender, _shares);
    }

    function withdrawAll() override external {
        uint256 _shares = balanceOf(msg.sender);
        _burn(msg.sender, _shares);
        token.transfer(msg.sender, _shares);
    }

    function approveContractAccess(address account) override external {}

    function getPricePerFullShare() override external view returns (uint256) {
        return 1e18;
    }

    function balance() override external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function pricePerShare() override external view returns (uint256) {}
    function withdrawalFee() override external view returns (uint256) {}
}
