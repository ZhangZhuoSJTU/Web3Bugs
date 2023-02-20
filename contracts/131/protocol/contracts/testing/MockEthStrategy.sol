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
contract MockEthStrategy is Authorization {
    using SafeERC20 for IERC20;

    address internal _underlying = address(0);

    address payable internal _vault;

    address public strategist;

    modifier onlyVault() {
        require(msg.sender == _vault, Error.UNAUTHORIZED_ACCESS);
        _;
    }

    constructor(IRoleManager roleManager) Authorization(roleManager) {
        strategist = address(0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B);
    }

    receive() external payable {}

    function setVault(address payable newVault) external onlyGovernance returns (bool) {
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
        uint256 currentBalance = address(this).balance;
        if (amount <= currentBalance) payable(address(_vault)).transfer(amount);
        else payable(address(_vault)).transfer(currentBalance);
        return true;
    }

    // Controller | Vault role - withdraw should always return to Vault
    function withdrawAll() external virtual onlyVault returns (uint256) {
        uint256 currentBalance = address(this).balance;
        payable(address(_vault)).transfer(currentBalance);
        return currentBalance;
    }

    function withdrawDust(address coin) external returns (bool) {
        require(coin != address(_underlying), "Unauthorized withdrawal");
        uint256 currentBalance = address(this).balance;
        require(currentBalance > 0, "Invalid amount to withdraw");
        payable(address(_vault)).transfer(currentBalance);
        return true;
    }

    // For testing
    function burnETH(uint256 amount) external {
        uint256 currentBalance = address(this).balance;
        require(currentBalance >= amount, Error.INSUFFICIENT_BALANCE);
        payable(address(0)).transfer(amount);
    }

    function stakeInVault(address lpToken, address stakerVault) external {
        IERC20(lpToken).approve(stakerVault, 4e18);
        IStakerVault(stakerVault).stake(4e18);
    }

    function name() external view returns (string memory) {
        return "MockStrategy";
    }

    function want() external view returns (address) {
        return _underlying;
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    function shutdown() external pure returns (bool) {
        return true;
    }

    function hasPendingFunds() external pure returns (bool) {
        return false;
    }

    function harvestable() external pure returns (uint256) {
        return 0;
    }

    function harvest() external pure returns (uint256) {
        return 0;
    }
}
