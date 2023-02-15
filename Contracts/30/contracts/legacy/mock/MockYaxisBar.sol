// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract MockYaxisBar is ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public immutable YAX;

    constructor(
        address _yax
    )
        public
        ERC20("Staked yAxis", "sYAX")
    {
        YAX = IERC20(_yax);
    }

    function availableBalance()
        external
        view
        returns (uint256)
    {
        return YAX.balanceOf(address(this));
    }

    function enter(
        uint256 _amount
    )
        external
    {
        require(_amount > 0, "!_amount");
        _mint(msg.sender, _amount.mul(1e18).div(getPricePerFullShare()));
        YAX.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function leave(
        uint256 _amount
    )
        public
    {
        require(_amount > 0, "!_amount");
        _burn(msg.sender, _amount);
        YAX.safeTransfer(msg.sender, _amount.mul(getPricePerFullShare()).div(1e18));
    }

    function exit()
        external
    {
        leave(balanceOf(msg.sender));
    }

    function getPricePerFullShare()
        public
        view
        returns (uint256)
    {
        return totalSupply() == 0
            ? 1e18
            : YAX.balanceOf(address(this)).mul(1e18).div(totalSupply());
    }
}
