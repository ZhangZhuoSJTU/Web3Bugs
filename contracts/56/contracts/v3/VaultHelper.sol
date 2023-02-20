// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./interfaces/ILiquidityGaugeV2.sol";
import "./interfaces/IVault.sol";

/**
 * @title VaultHelper
 * @notice The VaultHelper acts as a single contract that users may set
 * token approvals on for any token of any vault.
 * @dev This contract has no state and could be deployed by anyone if
 * they didn't trust the original deployer.
 */
contract VaultHelper {
    using SafeERC20 for IERC20;

    /**
     * @notice Deposits into the specified vault and stakes in the gauge
     * @dev Users must approve the vault helper to spend their token
     * @param _vault The address of the vault
     * @param _amount The amount of tokens to deposit
     */
    function depositVault(
        address _vault,
        uint256 _amount
    )
        external
    {
        require(_amount > 0, "!_amount");
        address _token = IVault(_vault).getToken();
        address _vaultToken = IVault(_vault).getLPToken();
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_token).safeApprove(_vault, 0);
        IERC20(_token).safeApprove(_vault, _amount);
        uint256 _shares = IVault(_vault).deposit(_amount);
        address _gauge = IVault(_vault).gauge();
        if (_gauge != address(0)) {
            IERC20(_vaultToken).safeApprove(_gauge, 0);
            IERC20(_vaultToken).safeApprove(_gauge, _shares);
            ILiquidityGaugeV2(_gauge).deposit(_shares);
            IERC20(_gauge).safeTransfer(msg.sender, _shares);
        } else {
            IERC20(_vaultToken).safeTransfer(msg.sender, _shares);
        }
    }

    function withdrawVault(
        address _vault,
        uint256 _amount
    )
        external
    {
        address _gauge = IVault(_vault).gauge();
        address _token = IVault(_vault).getToken();
        address _vaultToken = IVault(_vault).getLPToken();
        if (_gauge != address(0)) {
            IERC20(_gauge).safeTransferFrom(msg.sender, address(this), _amount);
            ILiquidityGaugeV2(_gauge).withdraw(_amount);
            IVault(_vault).withdraw(IERC20(_vaultToken).balanceOf(address(this)));
            IERC20(_token).safeTransfer(msg.sender, IERC20(_token).balanceOf(address(this)));
        } else {
            IERC20(_vaultToken).safeTransferFrom(msg.sender, address(this), _amount);
            IVault(_vault).withdraw(_amount);
            IERC20(_token).safeTransfer(msg.sender, IERC20(_token).balanceOf(address(this)));
        }
    }
}
