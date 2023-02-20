// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "./interfaces/IStrategy.sol";
import "./interfaces/IStrategyController.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SingleStrategyController is
    IStrategyController,
    Ownable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    address private _vault;
    IStrategy private _strategy;
    IERC20 private immutable _baseToken;

    modifier onlyVault() {
        require(msg.sender == _vault, "Caller is not the vault");
        _;
    }

    constructor(IERC20 _token) {
        require(address(_token) != address(0), "Zero address");
        _baseToken = _token;
    }

    // Assumes approval to take `_amount` has already been given by vault
    function deposit(uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _baseToken.safeTransferFrom(_vault, address(this), _amount);
        _strategy.deposit(_baseToken.balanceOf(address(this)));
    }

    function withdraw(address _recipient, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _strategy.withdraw(_recipient, _amount);
    }

    function migrate(IStrategy _newStrategy)
        external
        override
        onlyOwner
        nonReentrant
    {
        uint256 _oldStrategyBalance;
        IStrategy _oldStrategy = _strategy;
        _strategy = _newStrategy;
        _baseToken.approve(address(_newStrategy), type(uint256).max);
        if (address(_oldStrategy) != address(0)) {
            _baseToken.approve(address(_oldStrategy), 0);
            _oldStrategyBalance = _oldStrategy.totalValue();
            _oldStrategy.withdraw(address(this), _oldStrategyBalance);
            _newStrategy.deposit(_baseToken.balanceOf(address(this)));
        }
        emit StrategyMigrated(
            address(_oldStrategy),
            address(_newStrategy),
            _oldStrategyBalance
        );
    }

    function setVault(address _newVault) external override onlyOwner {
        _vault = _newVault;
        emit VaultChanged(_newVault);
    }

    function totalValue() external view override returns (uint256) {
        return _baseToken.balanceOf(address(this)) + _strategy.totalValue();
    }

    function getVault() external view override returns (address) {
        return _vault;
    }

    function getStrategy() external view override returns (IStrategy) {
        return _strategy;
    }

    function getBaseToken() external view override returns (IERC20) {
        return _baseToken;
    }
}
