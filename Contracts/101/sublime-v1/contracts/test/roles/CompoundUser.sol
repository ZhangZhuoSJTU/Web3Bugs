// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../../interfaces/Invest/ICToken.sol';
import '../../interfaces/Invest/ICEther.sol';
import '../../interfaces/Invest/IComptroller.sol';

contract CompoundUser {
    using SafeERC20 for IERC20;

    function mintCETH(address _cTokenAddress, uint256 _amount) public {
        ICEther(_cTokenAddress).mint{value: _amount}();
    }

    function mint(address _cTokenAddress, uint256 _amount) public returns (uint256) {
        return ICToken(_cTokenAddress).mint(_amount);
    }

    function borrow(address _cTokenAddress, uint256 _amount) public returns (uint256) {
        return ICToken(_cTokenAddress).borrow(_amount);
    }

    function repayBorrow(address _cTokenAddress, uint256 _amount) public returns (uint256) {
        return ICToken(_cTokenAddress).repayBorrow(_amount);
    }

    function setAllowance(
        address approvedAddress,
        address token,
        uint256 amount
    ) public {
        IERC20(token).approve(approvedAddress, amount);
    }

    function enterMarkets(address _comptroller, address[] calldata cTokens) public {
        IComptroller(_comptroller).enterMarkets(cTokens);
    }

    receive() external payable {}
}
