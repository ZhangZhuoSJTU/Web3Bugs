// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '../../interfaces/Invest/IyVault.sol';

import '../../interfaces/Invest/IyVault.sol';
import './IController.sol';

/*

 A strategy must implement the following calls;

 - deposit()
 - withdraw(address) must exclude any tokens used in the yield - Controller role - withdraw should return to Controller
 - withdraw(uint) - Controller | Vault role - withdraw should always return to vault
 - withdrawAll() - Controller | Vault role - withdraw should always return to vault
 - balanceOf()

 Where possible, strategies must remain as immutable as possible, instead of updating variables, we update the contract by linking it in the controller

*/

contract Strategy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public want;
    address public governance;
    address public controller;
    address public strategist;

    constructor(address _controller, address _want) {
        governance = msg.sender;
        controller = _controller;
        want = _want;
    }

    function _approveAll() internal {
        // IERC20(token).approve(mcd_join_eth_a, uint256(-1));
    }

    function deposit() public view {
        uint256 _token = IERC20(want).balanceOf(address(this));
        if (_token > 0) {
            // approve yVaultDAI use DAI
            // yVault(yVaultDAI).depositAll();
        }
    }

    // Controller only function for creating additional rewards from dust
    function withdraw(IERC20 _asset) external returns (uint256 balance) {
        require(msg.sender == controller, '!controller');
        balance = _asset.balanceOf(address(this));
        _asset.safeTransfer(controller, balance);
    }

    // Withdraw partial funds, normally used with a vault withdrawal
    function withdraw(uint256 _amount) external {
        require(msg.sender == controller, '!controller');
        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), '!vault'); // additional protection so we don't burn the funds

        IERC20(want).safeTransfer(_vault, _amount);
    }

    // Withdraw all funds, normally used when migrating strategies
    function withdrawAll() external returns (uint256 balance) {
        require(msg.sender == controller, '!controller');
        balance = IERC20(want).balanceOf(address(this));
        address _vault = IController(controller).vaults(address(want));
        IERC20(want).safeTransfer(_vault, balance);
    }

    function balanceOf() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    function setGovernance(address _governance) external {
        require(msg.sender == governance, '!governance');
        governance = _governance;
    }

    function setController(address _controller) external {
        require(msg.sender == governance, '!governance');
        controller = _controller;
    }
}
