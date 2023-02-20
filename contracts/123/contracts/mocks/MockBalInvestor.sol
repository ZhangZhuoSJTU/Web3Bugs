// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import "../CrvDepositorWrapper.sol";

contract MockBalInvestor is BalInvestor {
    constructor(
        IVault _balancerVault,
        address _bal,
        address _weth,
        bytes32 _balETHPoolId
    ) BalInvestor(_balancerVault, _bal, _weth, _balETHPoolId) {}

    function approveToken() external {
        _setApprovals();
    }

    function getBptPrice() external view returns (uint256) {
        return _getBptPrice();
    }

    function getMinOut(uint256 _amount, uint256 _outputBps) public view returns (uint256) {
        return _getMinOut(_amount, _outputBps);
    }

    function addBalToPool(uint256 amount, uint256 _minOut) external {
        _investBalToPool(amount, _minOut);
    }
}
