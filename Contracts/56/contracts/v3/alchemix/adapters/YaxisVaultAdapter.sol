// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import 'hardhat/console.sol';

import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';

import {FixedPointMath} from '../libraries/FixedPointMath.sol';
import {IDetailedERC20} from '../interfaces/IDetailedERC20.sol';
import {IVaultAdapter} from '../interfaces/IVaultAdapter.sol';
import {IVault} from '../../interfaces/IVault.sol';

/// @title YaxisVaultAdapter
///
/// @dev A vault adapter implementation which wraps a yAxis vault.
contract YaxisVaultAdapter is IVaultAdapter {
    using FixedPointMath for FixedPointMath.FixedDecimal;
    using SafeERC20 for IDetailedERC20;
    using SafeMath for uint256;

    /// @dev The vault that the adapter is wrapping.
    IVault public vault;

    /// @dev The address which has admin control over this contract.
    address public admin;

    constructor(IVault _vault, address _admin) public {
        vault = _vault;
        admin = _admin;
        updateApproval();
    }

    /// @dev A modifier which reverts if the caller is not the admin.
    modifier onlyAdmin() {
        require(admin == msg.sender, 'YaxisVaultAdapter: only admin');
        _;
    }

    /// @dev Gets the token that the vault accepts.
    ///
    /// @return the accepted token.
    function token() external view override returns (IDetailedERC20) {
        return IDetailedERC20(vault.getToken());
    }

    /// @dev Gets the total value of the assets that the adapter holds in the vault.
    ///
    /// @return the total assets.
    function totalValue() external view override returns (uint256) {
        return _sharesToTokens(IDetailedERC20(vault.getLPToken()).balanceOf(address(this)));
    }

    /// @dev Deposits tokens into the vault.
    ///
    /// @param _amount the amount of tokens to deposit into the vault.
    function deposit(uint256 _amount) external override {
        vault.deposit(_amount);
    }

    /// @dev Withdraws tokens from the vault to the recipient.
    ///
    /// This function reverts if the caller is not the admin.
    ///
    /// @param _recipient the account to withdraw the tokes to.
    /// @param _amount    the amount of tokens to withdraw.
    function withdraw(address _recipient, uint256 _amount) external override onlyAdmin {
        vault.withdraw(_tokensToShares(_amount));
        address _token = vault.getToken();
        IDetailedERC20(_token).safeTransfer(_recipient, _amount);
    }

    /// @dev Updates the vaults approval of the token to be the maximum value.
    function updateApproval() public {
        address _token = vault.getToken();
        IDetailedERC20(_token).safeApprove(address(vault), uint256(-1));
    }

    /// @dev Computes the number of tokens an amount of shares is worth.
    ///
    /// @param _sharesAmount the amount of shares.
    ///
    /// @return the number of tokens the shares are worth.

    function _sharesToTokens(uint256 _sharesAmount) internal view returns (uint256) {
        return _sharesAmount.mul(vault.getPricePerFullShare()).div(1e18);
    }

    /// @dev Computes the number of shares an amount of tokens is worth.
    ///
    /// @param _tokensAmount the amount of shares.
    ///
    /// @return the number of shares the tokens are worth.
    function _tokensToShares(uint256 _tokensAmount) internal view returns (uint256) {
        return _tokensAmount.mul(1e18).div(vault.getPricePerFullShare());
    }
}
