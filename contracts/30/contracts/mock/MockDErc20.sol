// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract MockDErc20 is ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public underlying;

    constructor(string memory name, string memory symbol, IERC20 _underlying) public ERC20(name, symbol) {
        underlying = _underlying;
    }

    function getExchangeRate() public pure returns (uint256) {
        return 2e18; // 1 dDAI = 2 DAI
    }

    function getTokenBalance(address _account) external view returns (uint256) {
        return balanceOf(_account).mul(getExchangeRate()).div(1e18);
    }

    function mint(address _account, uint256 _amount) external {
        uint256 _toMint = _amount.mul(1e18).div(getExchangeRate());
        underlying.safeTransferFrom(msg.sender, address(this), _amount);
        _mint(_account, _toMint);
    }

    function redeem(address _account, uint256 _amount) external {
        uint256 _underlyingAmount = _amount.mul(getExchangeRate()).div(1e18);
        _burn(_account, _amount);
        underlying.safeTransfer(msg.sender, _underlyingAmount);
    }
}
