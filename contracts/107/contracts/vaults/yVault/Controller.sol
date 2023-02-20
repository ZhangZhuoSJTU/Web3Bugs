// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/IStrategy.sol";

/// @title JPEG'd strategies controller
/// @notice Allows members of the `STRATEGIST_ROLE` to manage all the strategies in the JPEG'd ecosystem
contract Controller is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");

    IERC20 public immutable jpeg;
    address public feeAddress;

    mapping(IERC20 => address) public vaults;
    mapping(IERC20 => IStrategy) public strategies;
    mapping(IERC20 => mapping(IStrategy => bool)) public approvedStrategies;

    /// @param _feeAddress The address to send fees to
    constructor(address _jpeg, address _feeAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        setFeeAddress(_feeAddress);
        jpeg = IERC20(_jpeg);
    }

    /// @notice Allows the DAO to set the fee receiver address
    /// @param _feeAddress The new fee receiver address
    function setFeeAddress(address _feeAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_feeAddress != address(0), "INVALID_FEE_ADDRESS");
        feeAddress = _feeAddress;
    }

    /// @notice Allows the strategist to set the vault for a token
    /// @param _token The token to set the vault for
    /// @param _vault The vault address
    function setVault(IERC20 _token, address _vault)
        external
        onlyRole(STRATEGIST_ROLE)
    {
        require(vaults[_token] == address(0), "ALREADY_HAS_VAULT");
        require(_vault != address(0), "INVALID_VAULT");
        vaults[_token] = _vault;
    }

    /// @notice Allows the DAO to approve a strategy for a token
    /// @param _token The strategy's target token
    /// @param _strategy The strategy for the token
    function approveStrategy(IERC20 _token, IStrategy _strategy)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(address(_token) != address(0), "INVALID_TOKEN");
        require(address(_strategy) != address(0), "INVALID_STRATEGY");

        approvedStrategies[_token][_strategy] = true;
    }

    /// @notice Allows the DAO to revoke a strategy for a token
    /// @param _token The strategy's target token
    /// @param _strategy The strategy to revoke
    function revokeStrategy(IERC20 _token, IStrategy _strategy)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(address(_token) != address(0), "INVALID_TOKEN");
        require(address(_strategy) != address(0), "INVALID_STRATEGY");

        approvedStrategies[_token][_strategy] = false;
    }

    /// @notice Allows the members of the `STRATEGIST_ROLE` to change between approved strategies for `_token`
    /// @param _token The token to change strategy for
    /// @param _strategy The strategy to change to
    function setStrategy(IERC20 _token, IStrategy _strategy)
        external
        onlyRole(STRATEGIST_ROLE)
    {
        require(
            approvedStrategies[_token][_strategy] == true,
            "STRATEGY_NOT_APPROVED"
        );

        IStrategy _current = strategies[_token];
        if (address(_current) != address(0)) {
            //withdraw all funds from the current strategy
            _current.withdrawAll();
            _current.withdraw(address(jpeg));
        }
        strategies[_token] = _strategy;
    }

    /// @notice Allows anyone to deposit tokens from this contract to the token's strategy. Usually called by a vault after having sent tokens to this contract.
    /// @param _token The token to deposit
    /// @param _amount The amount of tokens to deposit
    function earn(IERC20 _token, uint256 _amount) external {
        IStrategy strategy = strategies[_token];
        _token.safeTransfer(address(strategy), _amount);
        strategy.deposit();
    }

    /// @return The amount of tokens held by `_token`'s strategy
    /// @param _token The token to check
    function balanceOf(IERC20 _token) external view returns (uint256) {
        return strategies[_token].balanceOf();
    }

    /// @return The amount of JPEG available to be withdrawn from `_token`'s strategy
    /// @param _token The token to check
    function balanceOfJPEG(IERC20 _token) external view returns (uint256) {
        return strategies[_token].balanceOfJPEG();
    }

    /// @notice Allows members of the `STRATEGIST_ROLE` to withdraw all strategy tokens from a strategy (e.g. In case of a bug in the strategy)
    /// The tokens will be sent to the token's vault
    /// @param _token The token to withdraw
    function withdrawAll(IERC20 _token) external onlyRole(STRATEGIST_ROLE) {
        strategies[_token].withdrawAll();
    }

    /// @notice Allows members of the `STRATEGIST_ROLE` to withdraw tokens stuck in this constract
    /// @param _token The token to withdraw
    /// @param _amount The amount of tokens to withdraw
    function inCaseTokensGetStuck(IERC20 _token, uint256 _amount)
        external
        onlyRole(STRATEGIST_ROLE)
    {
        _token.safeTransfer(msg.sender, _amount);
    }

    /// @notice Allows members of the `STRATEGIST_ROLE` to withdraw non strategy tokens from a strategy
    /// @param _strategy The strategy to withdraw from
    /// @param _token The token to withdraw
    function inCaseStrategyTokensGetStuck(IStrategy _strategy, address _token)
        external
        onlyRole(STRATEGIST_ROLE)
    {
        _strategy.withdraw(_token);
    }

    /// @notice Allows a vault to withdraw strategy tokens from a strategy (usually done during withdrawals from vaults)
    /// @param _token The token to withdraw
    /// @param _amount The amount of tokens to withdraw
    function withdraw(IERC20 _token, uint256 _amount) public {
        require(msg.sender == vaults[_token], "NOT_VAULT");
        strategies[_token].withdraw(_amount);
    }

    /// @notice Allows the vault for token `_token` to withdraw JPEG from
    /// `_token`'s strategy
    /// @param _token The strategy's token
    /// @param _to The address to send JPEG to
    function withdrawJPEG(
        IERC20 _token,
        address _to
    ) external {
        require(msg.sender == vaults[_token], "NOT_VAULT");
        strategies[_token].withdrawJPEG(_to);
    }
}
