// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract MockYearnV2 is ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public underlying;

    constructor(string memory name, string memory symbol, IERC20 _underlying) public ERC20(name, symbol) {
        underlying = _underlying;
    }

    function balance() public view returns (uint256) {
        return underlying.balanceOf(address(this));
    }

    function pricePerShare() public view returns (uint256) {
        return balance().mul(1e18).div(totalSupply());
    }

    function deposit() external returns (uint256) {
        uint256 _balance = underlying.balanceOf(msg.sender);
        return deposit(_balance);
    }

    function deposit(uint256 _amount) public returns (uint256) {
        uint256 underlyingTotal = balance();
        uint256 _before = balance();
        underlying.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = balance();
        _amount = _after.sub(_before);
        uint256 shares;
        if (totalSupply() == 0) {
            shares = _amount;
        } else {
            shares = (_amount.mul(totalSupply())).div(underlyingTotal);
        }
        _mint(msg.sender, shares);
        return shares;
    }

    function withdraw() external {
        withdraw(balanceOf(msg.sender));
    }

    function withdraw(uint256 _amount) public {
        uint256 ret = (balance().mul(_amount)).div(totalSupply());
        _burn(msg.sender, _amount);
        underlying.safeTransfer(msg.sender, ret);
    }

    function token() external view returns (address) {
        return address(underlying);
    }
}
