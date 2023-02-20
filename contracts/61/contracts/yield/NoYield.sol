// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IYield.sol';
import '../interfaces/Invest/ICEther.sol';
import '../interfaces/Invest/ICToken.sol';

/**
 * @title Yield contract
 * @notice Implements the functions to lock/unlock tokens into available exchanges
 * @author Sublime
 **/
contract NoYield is IYield, Initializable, OwnableUpgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /**
     * @notice stores the address of savings account contract
     **/
    address payable public savingsAccount;

    /**
     * @notice checks if contract is invoked by savings account
     **/
    modifier onlySavingsAccount() {
        require(_msgSender() == savingsAccount, 'Invest: Only savings account can invoke');
        _;
    }

    /**
     * @notice used to initialize the variables in the contract
     * @dev can only be called once
     * @param _owner address of the owner
     * @param _savingsAccount address of the savings account contract
     **/
    function initialize(address _owner, address payable _savingsAccount) external initializer {
        __Ownable_init();
        super.transferOwnership(_owner);

        _updateSavingsAccount(_savingsAccount);
    }

    /**
     * @notice used to query liquidity token for a given asset
     * @param _asset address of the asset
     * @return _tokenAddress address of the lqiudity token for the asset
     **/
    function liquidityToken(address _asset) external view override returns (address _tokenAddress) {
        _tokenAddress = _asset;
    }

    /**
     * @notice used to update savings account contract address
     * @dev can only be called by owner
     * @param _savingsAccount address of updated savings account contract
     **/
    function updateSavingsAccount(address payable _savingsAccount) external onlyOwner {
        _updateSavingsAccount(_savingsAccount);
    }

    function _updateSavingsAccount(address payable _savingsAccount) internal {
        require(_savingsAccount != address(0), 'Invest: zero address');
        savingsAccount = _savingsAccount;
        emit SavingsAccountUpdated(_savingsAccount);
    }

    /**
     * @notice used to withdraw all tokens of a type in case of emergencies
     * @dev only owner can withdraw
     * @param _asset address of the token being withdrawn
     * @param _wallet address to which tokens are withdrawn
     */
    function emergencyWithdraw(address _asset, address payable _wallet) external onlyOwner returns (uint256 received) {
        require(_wallet != address(0), 'cant burn');
        uint256 amount = IERC20(_asset).balanceOf(address(this));
        IERC20(_asset).safeTransfer(_wallet, received);
        received = amount;
    }

    /**
     * @notice Used to lock tokens in the protocol
     * @dev Asset Tokens to be locked must be approved to this contract by user
     * @param user the address of user
     * @param asset the address of token to invest
     * @param amount the amount of asset
     * @return sharesReceived amount of shares received
     **/
    function lockTokens(
        address user,
        address asset,
        uint256 amount
    ) external payable override onlySavingsAccount nonReentrant returns (uint256 sharesReceived) {
        require(amount != 0, 'Invest: amount');
        if (asset != address(0)) {
            IERC20(asset).safeTransferFrom(user, address(this), amount);
        } else {
            require(msg.value == amount, 'Invest: ETH amount');
        }
        sharesReceived = amount;
        emit LockedTokens(user, asset, sharesReceived);
    }

    /**
     * @notice Used to unlock tokens from the protocol
     * @param asset the address of underlying token
     * @param amount the amount of asset
     * @return tokensReceived received amount of tokens received
     **/
    function unlockTokens(address asset, uint256 amount)
        external
        override
        onlySavingsAccount
        nonReentrant
        returns (uint256 tokensReceived)
    {
        tokensReceived = _unlockTokens(asset, amount);
    }

    /**
     * @notice Used to unlock shares
     * @param asset the address of underlying token
     * @param amount the amount of shares to unlock
     * @return received amount of shares received
     **/
    function unlockShares(address asset, uint256 amount) external override onlySavingsAccount nonReentrant returns (uint256 received) {
        received = _unlockTokens(asset, amount);
    }

    function _unlockTokens(address asset, uint256 amount) internal returns (uint256 received) {
        require(amount != 0, 'Invest: amount');
        received = amount;
        if (asset == address(0)) {
            (bool success, ) = savingsAccount.call{value: received}('');
            require(success, 'Transfer failed');
        } else {
            IERC20(asset).safeTransfer(savingsAccount, received);
        }
        emit UnlockedTokens(asset, received);
    }

    /**
     * @dev Used to get amount of underlying tokens for given number of shares
     * @param shares the amount of shares
     * @param asset the address of token locked
     * @return amount amount of underlying tokens
     **/
    function getTokensForShares(uint256 shares, address asset) external pure override returns (uint256 amount) {
        amount = shares;
    }

    /**
     * @notice Used to get number of shares from an amount of underlying tokens
     * @param amount the amount of tokens
     * @param asset the address of token
     * @return shares amount of shares for given tokens
     **/
    function getSharesForTokens(uint256 amount, address asset) external pure override returns (uint256 shares) {
        shares = amount;
    }
}
