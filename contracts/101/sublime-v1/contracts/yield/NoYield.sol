// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../interfaces/IYield.sol';

/**
 * @title Yield contract
 * @notice Implements the functions to lock/unlock tokens into available exchanges
 * @author Sublime
 **/
contract NoYield is IYield, Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    //-------------------------------- Constants start --------------------------------/

    // address of treasury where tokens are sent in case of emergencies
    address public immutable TREASURY;

    /**
     * @notice stores the address of savings account contract
     **/
    address public immutable SAVINGS_ACCOUNT;

    //-------------------------------- Constants end --------------------------------/

    //-------------------------------- Global Variables start --------------------------------/

    mapping(address => bool) public tokenWhitelist;

    //-------------------------------- Global Variables end --------------------------------/

    //-------------------------------- Events start --------------------------------/

    /**
     * @notice emitted when all tokens are withdrawn, in case of emergencies
     * @param asset address of the token being withdrawn
     * @param withdrawTo address of the wallet to which tokens are withdrawn
     * @param tokensReceived amount of tokens received
     */
    event EmergencyWithdraw(address indexed asset, address indexed withdrawTo, uint256 tokensReceived);

    /**
     * @notice emitted when a token is whitelisted to be deposited
     * @param asset address of the token to be whitelisted
     */
    event TokenWhitelisted(address indexed asset);

    /**
     * @notice emitted when a token is removed from whitelist
     * @param asset address of the token being removed from whitelist
     */
    event TokenWhitelistRemoved(address indexed asset);

    //-------------------------------- Events end --------------------------------/

    //-------------------------------- Modifier start --------------------------------/

    /**
     * @notice checks if contract is invoked by savings account
     **/
    modifier onlySavingsAccount() {
        require(msg.sender == SAVINGS_ACCOUNT, 'NY:OSA1');
        _;
    }

    //-------------------------------- Modifier end --------------------------------/

    //-------------------------------- Init start --------------------------------/

    /**
     * @notice constructor
     * @param _treasury address of the TREASURY where tokens are sent in case of emergencies
     * @param _savingsAccount address of the savings account contract
     **/
    constructor(address _treasury, address _savingsAccount) {
        require(_treasury != address(0), 'NY:C1');
        require(_savingsAccount != address(0), 'C1');
        TREASURY = _treasury;
        SAVINGS_ACCOUNT = _savingsAccount;
    }

    /**
     * @notice used to initialize the variables in the contract
     * @dev can only be called once
     * @param _owner address of the owner
     **/
    function initialize(address _owner) external initializer {
        __Ownable_init();
        super.transferOwnership(_owner);
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
    }

    //-------------------------------- Init end --------------------------------/

    //-------------------------------- lock start --------------------------------/

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
    ) external override onlySavingsAccount nonReentrant returns (uint256) {
        require(amount != 0, 'NY:LT1');
        require(tokenWhitelist[asset], 'NY:LT2');
        IERC20(asset).safeTransferFrom(user, address(this), amount);
        uint256 sharesReceived = amount;
        emit LockedTokens(user, asset, sharesReceived);
        return sharesReceived;
    }

    //-------------------------------- lock end --------------------------------/

    //-------------------------------- unlock start --------------------------------/

    /**
     * @notice Used to unlock tokens from the protocol
     * @param asset the address of share token
     * @param amount the amount of asset
     * @return tokensReceived received amount of tokens received
     **/
    function unlockTokens(
        address asset,
        address to,
        uint256 amount
    ) external override onlySavingsAccount nonReentrant returns (uint256) {
        return (_unlockTokens(asset, to, amount));
    }

    /**
     * @notice Used to unlock shares
     * @param asset the address of token locked
     * @param amount the amount of shares to unlock
     * @return received amount of shares received
     **/
    function unlockShares(
        address asset,
        address to,
        uint256 amount
    ) external override onlySavingsAccount nonReentrant returns (uint256) {
        return (_unlockTokens(asset, to, amount));
    }

    function _unlockTokens(
        address asset,
        address to,
        uint256 amount
    ) private returns (uint256) {
        require(amount != 0, 'NY:IUT1');
        uint256 received = amount;
        IERC20(asset).safeTransfer(to, received);
        emit UnlockedTokens(asset, received);
        return received;
    }

    //-------------------------------- unlock end --------------------------------/

    //-------------------------------- Emergency functions start --------------------------------/

    /**
     * @notice used to withdraw all tokens of a type in case of emergencies
     * @dev only owner can withdraw
     * @param _asset address of the token being withdrawn
     * @param _amount amount to be withdraw. (if 0, it means all amount)
     */
    function emergencyWithdraw(address _asset, uint256 _amount) external onlyOwner returns (uint256) {
        uint256 received = _amount;
        if (_amount == 0) {
            received = IERC20(_asset).balanceOf(address(this));
        }
        IERC20(_asset).safeTransfer(TREASURY, received);
        emit EmergencyWithdraw(_asset, TREASURY, received);
        return received;
    }

    //-------------------------------- Emergency functions end --------------------------------/

    //-------------------------------- Emergency functions end --------------------------------/

    /**
     * @notice used to whitelist token to be deposited in noYield
     * @dev can only be called by owner
     * @param _asset address of token to whitelist
     **/
    function addTokenAddress(address _asset) external onlyOwner {
        require(!tokenWhitelist[_asset], 'NY:ATA1');
        tokenWhitelist[_asset] = true;
        emit TokenWhitelisted(_asset);
    }

    /**
     * @notice used to remove token from whitelist
     * @dev can only be called by owner
     * @param _asset address of token to remove from whitelist
     **/
    function removeTokenAddress(address _asset) external onlyOwner {
        require(tokenWhitelist[_asset], 'NY:RTA1');
        require(IERC20(_asset).balanceOf(address(this)) == 0, 'NY:RTA2');
        delete tokenWhitelist[_asset];
        emit TokenWhitelistRemoved(_asset);
    }

    //-------------------------------- Emergency functions end --------------------------------/

    //-------------------------------- utils start --------------------------------/

    /**
     * @dev Used to get amount of underlying tokens for given number of shares
     * @param shares the amount of shares
     * @return amount of underlying tokens
     **/
    function getTokensForShares(uint256 shares, address) external pure override returns (uint256) {
        return shares;
    }

    /**
     * @notice Used to get number of shares from an amount of underlying tokens
     * @param amount the amount of tokens
     * @return amount of shares for given tokens
     **/
    function getSharesForTokens(uint256 amount, address) external pure override returns (uint256) {
        return amount;
    }

    /**
     * @notice used to query liquidity token for a given asset
     * @param _asset address of the asset
     * @return address of the lqiudity token for the asset
     **/
    function liquidityToken(address _asset) external pure override returns (address) {
        return _asset;
    }

    //-------------------------------- utils end --------------------------------/
}
