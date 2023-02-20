// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../interfaces/IVaultReserve.sol";
import "../../libraries/Errors.sol";

import "../access/Authorization.sol";
import "../vault/Vault.sol";

/**
 * @notice Contract holding vault reserves
 * @dev ETH reserves are stored under address(0)
 */
contract VaultReserve is IVaultReserve, Authorization {
    using SafeERC20 for IERC20;

    uint256 internal constant _INITIAL_WITHDRAWAL_DELAY = 3 days;

    mapping(address => mapping(address => uint256)) private _balances;
    mapping(address => uint256) private _lastWithdrawal;

    uint256 public minWithdrawalDelay;

    modifier onlyVault() {
        require(_roleManager().hasRole(Roles.VAULT, msg.sender), Error.UNAUTHORIZED_ACCESS);
        _;
    }

    constructor(IRoleManager roleManager) Authorization(roleManager) {
        minWithdrawalDelay = _INITIAL_WITHDRAWAL_DELAY;
    }

    /**
     * @notice Deposit funds into vault reserve.
     * @notice Only callable by a whitelisted vault.
     * @param token Token to deposit.
     * @param amount Amount to deposit.
     * @return True if deposit was successful.
     */
    function deposit(address token, uint256 amount)
        external
        payable
        override
        onlyVault
        returns (bool)
    {
        if (token == address(0)) {
            require(msg.value == amount, Error.INVALID_AMOUNT);
            _balances[msg.sender][token] += msg.value;
        } else {
            require(msg.value == 0, Error.INVALID_VALUE);
            uint256 balance = IERC20(token).balanceOf(address(this));
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            uint256 newBalance = IERC20(token).balanceOf(address(this));
            uint256 received = newBalance - balance;
            require(received >= amount, Error.INVALID_AMOUNT);
            _balances[msg.sender][token] += received;
        }

        emit Deposit(msg.sender, token, amount);
        return true;
    }

    /**
     * @notice Withdraw funds from vault reserve.
     * @notice Only callable by a whitelisted vault.
     * @param token Token to withdraw.
     * @param amount Amount to withdraw.
     * @return True if withdrawal was successful.
     */
    function withdraw(address token, uint256 amount) external override onlyVault returns (bool) {
        require(canWithdraw(msg.sender), Error.RESERVE_ACCESS_EXCEEDED);
        uint256 accountBalance = _balances[msg.sender][token];
        require(accountBalance >= amount, Error.INSUFFICIENT_BALANCE);

        _balances[msg.sender][token] -= amount;
        _lastWithdrawal[msg.sender] = block.timestamp;

        if (token == address(0)) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success, Error.FAILED_TRANSFER);
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
        emit Withdraw(msg.sender, token, amount);
        return true;
    }

    /**
     * @notice Check token balance of a specific vault.
     * @param vault Vault to check balance of.
     * @param token Token to check balance in.
     * @return Token balance of vault.
     */
    function getBalance(address vault, address token) public view override returns (uint256) {
        return _balances[vault][token];
    }

    /**
     * @notice returns true if the vault is allowed to withdraw from the reserve
     */
    function canWithdraw(address vault) public view override returns (bool) {
        return block.timestamp >= _lastWithdrawal[vault] + minWithdrawalDelay;
    }
}
