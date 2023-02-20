// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../interfaces/IYield.sol';
import '../interfaces/Invest/ICEther.sol';
import '../interfaces/Invest/ICToken.sol';
import '../interfaces/Invest/IComptroller.sol';
import '../interfaces/IWETH9.sol';

/**
 * @title Yield contract
 * @notice Implements the functions to lock/unlock tokens into available exchanges
 * @author Sublime
 **/
contract CompoundYield is IYield, Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    //-------------------------------- Constants start --------------------------------/

    // address of treasury where tokens are sent in case of emergencies
    address public immutable TREASURY;

    /**
     * @notice stores the address of wrapped eth token
     **/
    address public immutable WETH;

    /**
     * @notice stores the address of savings account contract
     **/
    address public immutable SAVINGS_ACCOUNT;

    //-------------------------------- Constants end --------------------------------/

    //-------------------------------- Global vars start --------------------------------/

    /**
     * @notice the max amount that can be deposited for every token to the yield contract
     */
    mapping(address => uint256) public depositLimit;

    /**
     * @notice stores the address of liquidity token for a given base token
     */
    mapping(address => address) public override liquidityToken;

    //-------------------------------- Global vars end --------------------------------/

    //-------------------------------- Events start --------------------------------/

    /**
     * @notice emitted when all tokens are withdrawn, in case of emergencies
     * @param asset address of the token being withdrawn
     * @param withdrawTo address of the wallet to which tokens are withdrawn
     * @param tokensReceived amount of tokens received
     **/
    event EmergencyWithdraw(address indexed asset, address indexed withdrawTo, uint256 tokensReceived);

    /**
     * @notice emitted when liquidity token address of an asset is updated
     * @param asset the address of asset
     * @param protocolToken address of the liquidity token for the asset
     **/
    event TokenAddressesUpdated(address indexed asset, address indexed protocolToken);

    //-------------------------------- Events end --------------------------------/

    //-------------------------------- Modifiers start --------------------------------/

    /**
     * @notice checks if contract is invoked by savings account
     **/
    modifier onlySavingsAccount() {
        require(msg.sender == SAVINGS_ACCOUNT, 'CY:OSA1');
        _;
    }

    //-------------------------------- Modifiers end --------------------------------/

    //-------------------------------- Init start --------------------------------/

    /**
     * @notice constructor
     * @param _weth address of the wrapped Ether contract
     * @param _treasury address of the TREASURY where tokens are sent in case of emergencies
     * @param _savingsAccount address of the savings account contract
     **/
    constructor(
        address _weth,
        address _treasury,
        address _savingsAccount
    ) {
        require(_weth != address(0), 'CY:C1');
        require(_treasury != address(0), 'CY:C2');
        require(_savingsAccount != address(0), 'CY:C3');
        WETH = _weth;
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
     * @notice Used to lock tokens in available protocol
     * @dev Asset Tokens to be locked must be approved to this contract by user
     * @param _user the address of user
     * @param _asset the address of token to invest
     * @param _amount the amount of asset
     * @return sharesReceived amount of shares received
     **/
    function lockTokens(
        address _user,
        address _asset,
        uint256 _amount
    ) external override onlySavingsAccount nonReentrant returns (uint256) {
        uint256 _sharesReceived;
        address _investedTo = liquidityToken[_asset];

        uint256 _totalBalance = ICToken(_investedTo).balanceOfUnderlying(address(this));
        require(depositLimit[_asset] > _totalBalance.add(_amount), 'CY:LT1');

        IERC20(_asset).safeTransferFrom(_user, address(this), _amount);
        if (_asset == WETH) {
            IWETH9(WETH).withdraw(_amount);
            _sharesReceived = _depositETH(_investedTo, _amount);
        } else {
            _sharesReceived = _depositERC20(_asset, _investedTo, _amount);
        }
        emit LockedTokens(_user, _investedTo, _sharesReceived);
        return _sharesReceived;
    }

    function _depositETH(address _cToken, uint256 _amount) private returns (uint256) {
        uint256 _initialCTokenBalance = IERC20(_cToken).balanceOf(address(this));
        //mint cToken
        ICEther(_cToken).mint{value: _amount}();

        uint256 _latterCTokenBalance = IERC20(_cToken).balanceOf(address(this));
        uint256 _sharesReceived = _latterCTokenBalance.sub(_initialCTokenBalance);
        return _sharesReceived;
    }

    function _depositERC20(
        address _asset,
        address _cToken,
        uint256 _amount
    ) private returns (uint256) {
        uint256 _initialCTokenBalance = IERC20(_cToken).balanceOf(address(this));
        //mint cToken
        IERC20(_asset).safeApprove(_cToken, 0);
        IERC20(_asset).safeApprove(_cToken, _amount);
        require(ICToken(_cToken).mint(_amount) == 0, 'CY:IDERC1');

        uint256 _latterCTokenBalance = IERC20(_cToken).balanceOf(address(this));
        uint256 _sharesReceived = _latterCTokenBalance.sub(_initialCTokenBalance);
        return _sharesReceived;
    }

    //-------------------------------- lock end --------------------------------/

    //-------------------------------- unlock start --------------------------------/

    /**
     * @notice Used to unlock tokens from available protocol
     * @param _asset the address of the underlying token (Example: For Compound, Underlying token of cTokenA is TokenA)
     * @param _to address to transfer tokens to
     * @param _shares the amount of shares to unlock
     * @return amount of tokens received
     **/
    function unlockTokens(
        address _asset,
        address _to,
        uint256 _shares
    ) external override onlySavingsAccount nonReentrant returns (uint256) {
        address _investedTo = liquidityToken[_asset];
        uint256 _received;
        if (_asset == WETH) {
            _received = _withdrawETH(_investedTo, _shares);
            IWETH9(WETH).deposit{value: _received}();
        } else {
            _received = _withdrawERC(_asset, _investedTo, _shares);
        }
        IERC20(_asset).safeTransfer(_to, _received);

        emit UnlockedTokens(_asset, _received);
        return _received;
    }

    /**
     * @notice Used to unlock shares
     * @param _asset the address of share token (Example: For Compound, Share token of TokenA is cTokenA)
     * @param _to address to transfer shares to
     * @param _shares the amount of shares to unlock
     * @return received amount of shares received
     **/
    function unlockShares(
        address _asset,
        address _to,
        uint256 _shares
    ) external override onlySavingsAccount nonReentrant returns (uint256) {
        if (_shares == 0) return 0;

        IERC20(_asset).safeTransfer(_to, _shares);

        emit UnlockedShares(_asset, _shares);
        return _shares;
    }

    function _withdrawETH(address _cToken, uint256 _shares) private returns (uint256) {
        uint256 _ethBalance = address(this).balance;

        require(ICEther(_cToken).redeem(_shares) == 0, 'CY:IWE1');

        return (address(this).balance.sub(_ethBalance));
    }

    function _withdrawERC(
        address _asset,
        address _cToken,
        uint256 _shares
    ) private returns (uint256) {
        uint256 _initialAssetBalance = IERC20(_asset).balanceOf(address(this));
        require(ICToken(_cToken).redeem(_shares) == 0, 'CY:IWERC1');
        uint256 _tokensReceived = IERC20(_asset).balanceOf(address(this)).sub(_initialAssetBalance);
        return _tokensReceived;
    }

    //-------------------------------- unlock end --------------------------------/

    //-------------------------------- Admin functions start --------------------------------/

    /**
     * @notice used to withdraw all tokens of a type in case of emergencies
     * @dev only owner can withdraw
     * @param _asset address of the token being withdrawn
     * @param _wallet address to which tokens are withdrawn
     */
    function emergencyWithdraw(address _asset, address _wallet) external onlyOwner returns (uint256) {
        require(_wallet != address(0), 'CY:EW1');
        address _investedTo = liquidityToken[_asset];
        uint256 _received;

        uint256 _amount = ICToken(_investedTo).balanceOfUnderlying(address(this));

        uint256 _availableCash = ICToken(_investedTo).getCash();
        if (_amount > _availableCash) {
            _amount = _availableCash;
        }

        uint256 _amountInShares = getSharesForTokens(_amount, _asset);

        if (_asset == WETH) {
            _received = _withdrawETH(_investedTo, _amountInShares);
            IWETH9(WETH).deposit{value: _received}();
        } else {
            _received = _withdrawERC(_asset, _investedTo, _amountInShares);
        }
        IERC20(_asset).safeTransfer(_wallet, _received);

        emit EmergencyWithdraw(_asset, _wallet, _received);
        return _received;
    }

    /**
     * @notice withdraw the comp tokens supplied
     * @dev only owner can call
     * @param _comptroller address of the comptroller contract
     * @param _compToken address of the comp token
     */
    function claimCompTokens(address _comptroller, address _compToken) external onlyOwner returns (uint256) {
        IComptroller(_comptroller).claimComp(address(this));
        uint256 _compBalance = IERC20(_compToken).balanceOf(address(this));
        IERC20(_compToken).safeTransfer(TREASURY, _compBalance);
        return _compBalance;
    }

    //-------------------------------- Admin functions end --------------------------------/

    //-------------------------------- Global var setters start --------------------------------/

    function setDepositLimit(address _asset, uint256 _limit) external onlyOwner {
        depositLimit[_asset] = _limit;
    }

    /**
     * @notice used to link a liquidity token to an asset
     * @dev can only be called by owner
     * @param _asset address of the token
     * @param _liquidityToken address of the liquidityToken for the given token
     **/
    function addTokenAddress(address _asset, address _liquidityToken) external onlyOwner {
        require(liquidityToken[_asset] == address(0), 'CY:ATA1');
        liquidityToken[_asset] = _liquidityToken;
        emit TokenAddressesUpdated(_asset, _liquidityToken);
    }

    /**
     * @notice used to update liquidity token for an asset
     * @dev can only be called by owner and only in emergency scenarios, add/removeTokenAddress is used in general
     * @param _asset address of the token
     * @param _liquidityToken address of the liquidityToken for the given token
     **/
    function forceUpdateTokenAddress(address _asset, address _liquidityToken) external onlyOwner {
        liquidityToken[_asset] = _liquidityToken;
        emit TokenAddressesUpdated(_asset, _liquidityToken);
    }

    /**
     * @notice used to remove liquidity token associated with an asset
     * @dev can only be called by owner
     * @param _asset address of the token
     * @param _liquidityToken address of the liquidityToken for the given token
     **/
    function removeTokenAddress(address _asset, address _liquidityToken) external onlyOwner {
        address _currentLiquidityToken = liquidityToken[_asset];
        require(_currentLiquidityToken != address(0), 'CY:RTA1');
        require(_currentLiquidityToken == _liquidityToken, 'CY:RTA2');
        require(ICToken(_currentLiquidityToken).balanceOfUnderlying(address(this)) == 0, 'CY:RTA3');
        delete liquidityToken[_asset];
        emit TokenAddressesUpdated(_asset, address(0));
    }

    //-------------------------------- Global var setters end --------------------------------/

    //-------------------------------- Utils start --------------------------------/
    /**
     * @dev Used to get amount of underlying tokens for given number of shares
     * @param _shares the amount of shares
     * @param _asset the address of token locked
     * @return amount of underlying tokens
     **/
    function getTokensForShares(uint256 _shares, address _asset) external override returns (uint256) {
        //balanceOfUnderlying returns underlying balance for total shares
        if (_shares == 0) return 0;
        address cToken = liquidityToken[_asset];
        uint256 exchangeRateCurrent = ICToken(cToken).exchangeRateCurrent();
        require(exchangeRateCurrent != 0, 'CY:GTFS1');
        uint256 amount = exchangeRateCurrent.mul(_shares).div(1e18);
        return amount;
    }

    /**
     * @notice Used to get number of shares from an amount of underlying tokens
     * @param _amount the amount of tokens
     * @param _asset the address of token
     * @return amount of shares for given tokens
     **/
    function getSharesForTokens(uint256 _amount, address _asset) public override returns (uint256) {
        address cToken = liquidityToken[_asset];
        uint256 exchangeRateCurrent = ICToken(cToken).exchangeRateCurrent();
        require(exchangeRateCurrent != 0, 'CY:GSFT1');
        return (_amount.mul(1e18)).div(exchangeRateCurrent);
    }

    //-------------------------------- Utils end --------------------------------/

    receive() external payable {
        require(msg.sender == liquidityToken[WETH] || msg.sender == WETH, 'CY:R1');
    }
}
