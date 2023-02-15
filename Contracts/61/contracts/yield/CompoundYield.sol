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
contract CompoundYield is IYield, Initializable, OwnableUpgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /**
     * @notice stores the address of savings account contract
     **/
    address payable public savingsAccount;

    /**
     * @notice stores the address of liquidity token for a given base token
     */
    mapping(address => address) public override liquidityToken;

    /**
     * @notice emitted when liquidity token address of an asset is updated
     * @param asset the address of asset
     * @param protocolToken address of the liquidity token for the asset
     **/
    event ProtocolAddressesUpdated(address indexed asset, address indexed protocolToken);

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
     * @notice used to update liquidity token for a asset
     * @dev can only be called by owner
     * @param _asset address of the token
     * @param _liquidityToken address of the liquidityToken for the given token
     **/
    function updateProtocolAddresses(address _asset, address _liquidityToken) external onlyOwner {
        liquidityToken[_asset] = _liquidityToken;
        emit ProtocolAddressesUpdated(_asset, _liquidityToken);
    }

    /**
     * @notice used to withdraw all tokens of a type in case of emergencies
     * @dev only owner can withdraw
     * @param _asset address of the token being withdrawn
     * @param _wallet address to which tokens are withdrawn
     */
    function emergencyWithdraw(address _asset, address payable _wallet) external onlyOwner returns (uint256 received) {
        require(_wallet != address(0), 'cant burn');
        address investedTo = liquidityToken[_asset];
        uint256 amount = IERC20(investedTo).balanceOf(address(this));

        if (_asset == address(0)) {
            received = _withdrawETH(investedTo, amount);
            (bool success, ) = _wallet.call{value: received}('');
            require(success, 'Transfer failed');
        } else {
            received = _withdrawERC(_asset, investedTo, amount);
            IERC20(_asset).safeTransfer(_wallet, received);
        }
    }

    /**
     * @notice Used to lock tokens in available protocol
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
        address investedTo = liquidityToken[asset];
        if (asset == address(0)) {
            require(msg.value == amount, 'Invest: ETH amount');
            sharesReceived = _depositETH(investedTo, amount);
        } else {
            IERC20(asset).safeTransferFrom(user, address(this), amount);
            sharesReceived = _depositERC20(asset, investedTo, amount);
        }
        emit LockedTokens(user, investedTo, sharesReceived);
    }

    /**
     * @notice Used to unlock tokens from available protocol
     * @param asset the address of underlying token
     * @param amount the amount of asset
     * @return received amount of tokens received
     **/
    function unlockTokens(address asset, uint256 amount) external override onlySavingsAccount nonReentrant returns (uint256 received) {
        require(amount != 0, 'Invest: amount');
        address investedTo = liquidityToken[asset];

        if (asset == address(0)) {
            received = _withdrawETH(investedTo, amount);
            (bool success, ) = savingsAccount.call{value: received}('');
            require(success, 'Transfer failed');
        } else {
            received = _withdrawERC(asset, investedTo, amount);
            IERC20(asset).safeTransfer(savingsAccount, received);
        }

        emit UnlockedTokens(asset, received);
    }

    /**
     * @notice Used to unlock shares
     * @param asset the address of underlying token
     * @param amount the amount of shares to unlock
     * @return received amount of shares received
     **/
    function unlockShares(address asset, uint256 amount) external override onlySavingsAccount nonReentrant returns (uint256) {
        if (amount == 0) {
            return 0;
        }

        require(asset != address(0), 'Asset address cannot be address(0)');
        IERC20(asset).safeTransfer(savingsAccount, amount);

        emit UnlockedShares(asset, amount);
        return amount;
    }

    /**
     * @dev Used to get amount of underlying tokens for given number of shares
     * @param shares the amount of shares
     * @param asset the address of token locked
     * @return amount amount of underlying tokens
     **/
    function getTokensForShares(uint256 shares, address asset) public override returns (uint256 amount) {
        //balanceOfUnderlying returns underlying balance for total shares
        if (shares == 0) return 0;
        address cToken = liquidityToken[asset];
        amount = ICToken(cToken).balanceOfUnderlying(address(this)).mul(shares).div(IERC20(cToken).balanceOf(address(this)));
    }

    /**
     * @notice Used to get number of shares from an amount of underlying tokens
     * @param amount the amount of tokens
     * @param asset the address of token
     * @return shares amount of shares for given tokens
     **/
    function getSharesForTokens(uint256 amount, address asset) external override returns (uint256 shares) {
        shares = (amount.mul(1e18)).div(getTokensForShares(1e18, asset));
    }

    function _depositETH(address cToken, uint256 amount) internal returns (uint256 sharesReceived) {
        uint256 initialCTokenBalance = IERC20(cToken).balanceOf(address(this));

        //mint cToken
        ICEther(cToken).mint{value: amount}();

        sharesReceived = IERC20(cToken).balanceOf(address(this)).sub(initialCTokenBalance);
    }

    function _depositERC20(
        address asset,
        address cToken,
        uint256 amount
    ) internal returns (uint256 sharesReceived) {
        uint256 initialCTokenBalance = IERC20(cToken).balanceOf(address(this));
        //mint cToken
        IERC20(asset).approve(cToken, 0);
        IERC20(asset).approve(cToken, amount);
        require(ICToken(cToken).mint(amount) == 0, 'Error in minting tokens');
        sharesReceived = IERC20(cToken).balanceOf(address(this)).sub(initialCTokenBalance);
    }

    function _withdrawETH(address cToken, uint256 amount) internal returns (uint256 received) {
        uint256 ethBalance = address(this).balance;

        require(ICToken(cToken).redeem(amount) == 0, 'Error in unwrapping');

        received = address(this).balance.sub(ethBalance);
    }

    function _withdrawERC(
        address asset,
        address cToken,
        uint256 amount
    ) internal returns (uint256 tokensReceived) {
        uint256 initialAssetBalance = IERC20(asset).balanceOf(address(this));
        require(ICToken(cToken).redeem(amount) == 0, 'Error in unwrapping');
        tokensReceived = IERC20(asset).balanceOf(address(this)).sub(initialAssetBalance);
    }

    //to apply check
    receive() external payable {}
}
