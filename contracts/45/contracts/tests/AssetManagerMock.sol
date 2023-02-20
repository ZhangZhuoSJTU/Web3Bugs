//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
pragma abicoder v1;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../Controller.sol";
import "../interfaces/IMarketRegistry.sol";
import "../interfaces/IMoneyMarketAdapter.sol";
import "../interfaces/IAssetManager.sol";

/**
 *  @title AssetManager
 *  @dev Manage the token assets deposited by components and admins, and invest tokens to the integrated underlying lending protocols.
 */
contract AssetManagerMock is Controller {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;

    IMoneyMarketAdapter[] public moneyMarkets;
    mapping(address => Market) public supportedMarkets;
    address[] public supportedTokensList;
    //record admin or userManager balance
    mapping(address => mapping(address => uint256)) public balances; //1 user 2 token
    mapping(address => uint256) public totalPrincipal; //total stake amount
    address public marketRegistry;
    uint256[] public withdrawSeq; // Priority sequence of money market indices for processing withdraws

    struct Market {
        bool isSupported;
    }

    function __AssetManager_init() public initializer {}

    function getPoolBalance(address tokenAddress) public view returns (uint256) {
        IERC20Upgradeable poolToken = IERC20Upgradeable(tokenAddress);
        uint256 balance = poolToken.balanceOf(address(this));
        if (isMarketSupported(tokenAddress)) {
            return totalSupplyView(tokenAddress) + balance;
        } else {
            return balance;
        }
    }

    function getLoanableAmount(address tokenAddress) public view returns (uint256) {
        uint256 poolBalance = getPoolBalance(tokenAddress);
        if (poolBalance > totalPrincipal[tokenAddress]) return poolBalance - totalPrincipal[tokenAddress];
        return 0;
    }

    function totalSupply(address) public pure returns (uint256) {
        return 0;
    }

    function totalSupplyView(address) public pure returns (uint256) {
        return 0;
    }

    function isMarketSupported(address) public pure returns (bool) {
        return false;
    }

    function deposit(address token, uint256 amount) external returns (bool) {
        IERC20Upgradeable poolToken = IERC20Upgradeable(token);
        require(amount > 0, "AssetManager: amount can not be zero");

        if (!_isUToken(msg.sender, token)) {
            balances[msg.sender][token] += amount;
            totalPrincipal[token] += amount;
        }

        poolToken.safeTransferFrom(msg.sender, address(this), amount);

        return true;
    }

    function withdraw(
        address token,
        address account,
        uint256 amount
    ) external returns (bool) {
        uint256 remaining = amount;

        // If there are tokens in Asset Manager then transfer them on priority
        uint256 selfBalance = IERC20Upgradeable(token).balanceOf(address(this));
        if (selfBalance > 0) {
            uint256 withdrawAmount = selfBalance < remaining ? selfBalance : remaining;
            remaining -= withdrawAmount;
            IERC20Upgradeable(token).safeTransfer(account, withdrawAmount);
        }

        if (!_isUToken(msg.sender, token)) {
            balances[msg.sender][token] = balances[msg.sender][token] - amount + remaining;
            totalPrincipal[token] = totalPrincipal[token] - amount + remaining;
        }

        return true;
    }

    function debtWriteOff(address token, uint256 amount) external {}

    function addToken(address tokenAddress) external {
        supportedTokensList.push(tokenAddress);
        supportedMarkets[tokenAddress].isSupported = true;
    }

    /**
     *  @dev Claim the tokens left on AssetManager balance, in case there are tokens get stuck here.
     *  @param tokenAddress ERC20 token address
     *  @param recipient Recipient address
     */
    function claimTokens(address tokenAddress, address recipient) external {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        token.safeTransfer(recipient, balance);
    }

    function _checkSenderBalance(
        address sender,
        address tokenAddress,
        uint256 amount
    ) private view returns (bool) {
        if (_isUToken(sender, tokenAddress)) {
            // For all the lending markets, which have no deposits, return the tokens from the pool
            return getLoanableAmount(tokenAddress) >= amount;
        } else {
            return balances[sender][tokenAddress] >= amount;
        }
    }

    function _isUToken(address, address) private pure returns (bool) {
        return true;
    }

    function _isUserManager(address, address) private pure returns (bool) {
        return true;
    }
}
