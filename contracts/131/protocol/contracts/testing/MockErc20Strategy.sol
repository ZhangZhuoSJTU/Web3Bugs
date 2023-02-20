// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../access/Authorization.sol";
import "../../interfaces/IStakerVault.sol";

/**
 * MockStrategy for testing.
 * This strategy does not do anything with funds it receives.
 */
contract MockErc20Strategy is Authorization {
    using SafeERC20 for IERC20;

    address internal _underlying;

    address internal _vault;

    address public strategist;

    modifier onlyVault() {
        require(msg.sender == _vault, Error.UNAUTHORIZED_ACCESS);
        _;
    }

    constructor(IRoleManager roleManager, address underlying) Authorization(roleManager) {
        _underlying = underlying;
        strategist = address(0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B);
    }

    function setVault(address newVault) external onlyGovernance returns (bool) {
        require(_vault == address(0), "Vault can only be set once");
        require(newVault != address(0), "Vault cannot be zero address");
        _vault = newVault;
        return true;
    }

    // Deposits token (same as want() returns) into a smart contact specified by the Strategy.
    function deposit() external payable onlyVault returns (bool) {
        // Does nothing in mock
        return true;
    }

    // Controller | Vault role - withdraw should always return to Vault
    function withdraw(uint256 amount) external onlyVault returns (bool) {
        uint256 currentBalance = IERC20(_underlying).balanceOf(address(this));
        if (amount <= currentBalance) IERC20(_underlying).safeTransfer(_vault, amount);
        else IERC20(_underlying).safeTransfer(_vault, currentBalance);
        return true;
    }

    // Controller | Vault role - withdraw should always return to Vault
    function withdrawAll() external virtual onlyVault returns (uint256) {
        uint256 currentBalance = IERC20(_underlying).balanceOf(address(this));
        IERC20(_underlying).safeTransfer(_vault, currentBalance);
        return currentBalance;
    }

    function withdrawDust(address coin) external returns (bool) {
        require(coin != address(_underlying), "Unauthorized withdrawal");
        uint256 currentBalance = IERC20(coin).balanceOf(address(this));
        require(currentBalance > 0, "Invalid amount to withdraw");
        IERC20(coin).transfer(_vault, currentBalance);
        return true;
    }

    function transfer(
        address coin,
        address to,
        uint256 amount
    ) external returns (bool) {
        require(amount > 0, "Invalid amount to transfer");
        IERC20(coin).transfer(to, amount);
        return true;
    }

    function drainFunds(address account) external {
        uint256 _balance = IERC20(_underlying).balanceOf(address(this));
        IERC20(_underlying).transfer(account, _balance);
    }

    function stakeInVault(address lpToken, address stakerVault) external {
        IERC20(lpToken).approve(stakerVault, 4e18);
        IStakerVault(stakerVault).stake(4e18);
    }

    function want() external view returns (address) {
        return _underlying;
    }

    function balance() external view returns (uint256) {
        return IERC20(_underlying).balanceOf(address(this));
    }

    function name() external pure returns (string memory) {
        return "MockStrategy";
    }

    function shutdown() external pure returns (bool) {
        return true;
    }

    function harvestable() external pure returns (uint256) {
        return 0;
    }

    function harvest() external pure returns (uint256) {
        return 0;
    }

    function hasPendingFunds() external pure returns (bool) {
        return false;
    }
}
