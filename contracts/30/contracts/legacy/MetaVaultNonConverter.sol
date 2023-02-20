// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase
// solhint-disable var-name-mixedcase

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./IConverter.sol";
import "./IVaultManager.sol";

/**
 * @title MetaVaultNonConverter (StableSwap3PoolConverter)
 * @notice The StableSwap3PoolConverter is used to convert funds on Curve's 3Pool.
 * This is a safe version that does not allow the vault to be used for arbitrage.
 */
contract MetaVaultNonConverter is IConverter {
    using SafeERC20 for IERC20;

    IVaultManager public immutable vaultManager;
    IERC20 public immutable token3CRV; // 3Crv

    /**
     * @param _token3CRV The address of the 3CRV token
     * @param _vaultManager The address of the Vault Manager
     */
    constructor(
        IERC20 _token3CRV,
        IVaultManager _vaultManager
    ) public {
        token3CRV = _token3CRV;
        vaultManager = _vaultManager;
    }

    /**
     * @notice Called by Governance to enable or disable a strategy to use the converter
     */
    function setStrategy(address, bool) external override onlyGovernance {
        return;
    }

    /**
     * @notice Called by Governance to approve a token address to be spent by an address
     * @param _token The address of the token
     * @param _spender The address of the spender
     * @param _amount The amount to spend
     */
    function approveForSpender(
        IERC20 _token,
        address _spender,
        uint256 _amount
    ) external onlyGovernance {
        _token.safeApprove(_spender, _amount);
    }

    /**
     * @notice Returns the address of the 3CRV token
     */
    function token() external view override returns (address) {
        return address(token3CRV);
    }

    /**
     * @notice Converts the amount of input tokens to output tokens
     */
    function convert(
        address,
        address,
        uint256
    ) external override returns (uint256) {
        revert("Only 3CRV allowed");
    }

    /**
     * @notice Checks the amount of input tokens to output tokens
     */
    function convert_rate(
        address,
        address,
        uint256
    ) external override view returns (uint256) {
        revert("Only 3CRV allowed");
    }

    /**
     * @notice Converts stables of the 3Pool to 3CRV
     */
    function convert_stables(
        uint256[3] calldata
    ) external override returns (uint256) {
        revert("Only 3CRV allowed");
    }

    /**
     * @notice Checks the amount of 3CRV given for the amounts
     */
    function calc_token_amount(
        uint256[3] calldata,
        bool
    ) external override view returns (uint256) {
        revert("Only 3CRV allowed");
    }

    /**
     * @notice Checks the amount of an output token given for 3CRV
     */
    function calc_token_amount_withdraw(
        uint256,
        address
    ) external override view returns (uint256) {
        revert("Only 3CRV allowed");
    }

    /**
     * @notice Allows Governance to withdraw tokens from the converter
     * @dev This contract should never have any tokens in it at the end of a transaction
     * @param _token The address of the token
     * @param _amount The amount to withdraw
     * @param _to The address to receive the tokens
     */
    function governanceRecoverUnsupported(
        IERC20 _token,
        uint256 _amount,
        address _to
    ) external onlyGovernance {
        _token.safeTransfer(_to, _amount);
    }

    /**
     * @dev Throws if not called by a controller or governance
     */
    modifier onlyGovernance() {
        require(vaultManager.controllers(msg.sender)
            || msg.sender == vaultManager.governance(), "!governance");
        _;
    }
}
