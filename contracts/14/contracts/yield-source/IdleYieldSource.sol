// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./interfaces/pooltogether/IProtocolYieldSource.sol";
import "./interfaces/idle/IIdleToken.sol";
import "./access/AssetManager.sol";

/// @title An pooltogether yield source for Idle token
/// @author Sunny Radadiya
contract IdleYieldSource is IProtocolYieldSource, Initializable, ReentrancyGuardUpgradeable, ERC20Upgradeable, AssetManager  {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address public idleToken;
    address public underlyingAsset;
    uint256 public constant ONE_IDLE_TOKEN = 10**18;

    /// @notice Emitted when the yield source is initialized
    event IdleYieldSourceInitialized(address indexed idleToken);

    /// @notice Emitted when asset tokens are redeemed from the yield source
    event RedeemedToken(
        address indexed from,
        uint256 shares,
        uint256 amount
    );

    /// @notice Emitted when asset tokens are supplied to the yield source
    event SuppliedTokenTo(
        address indexed from,
        uint256 shares,
        uint256 amount,
        address indexed to
    );

    /// @notice Emitted when asset tokens are supplied to sponsor the yield source
    event Sponsored(
        address indexed from,
        uint256 amount
    );

    /// @notice Emitted when ERC20 tokens other than yield source's idleToken are withdrawn from the yield source
    event TransferredERC20(
        address indexed from,
        address indexed to,
        uint256 amount,
        address indexed token
    );

    /// @notice Initializes the yield source with Idle Token
    /// @param _idleToken Idle Token address
    function initialize(
        address _idleToken
    ) public initializer {

        __Ownable_init();

        idleToken = _idleToken;
        underlyingAsset = IIdleToken(idleToken).token();

        IERC20Upgradeable(underlyingAsset).safeApprove(idleToken, type(uint256).max);
        emit IdleYieldSourceInitialized(idleToken);
    }

    /// @notice Returns the ERC20 asset token used for deposits.
    /// @return The ERC20 asset token
    function depositToken() external view override returns (address) {
        return underlyingAsset;
    }

    /// @notice Returns the total balance (in asset tokens).  This includes the deposits and interest.
    /// @return The underlying balance of asset tokens
    function balanceOfToken(address addr) external view override returns (uint256) {
        return _sharesToToken(balanceOf(addr));
    }

    /// @notice Calculates the balance of Total idle Tokens Contract hasv
    /// @return balance of Idle Tokens
    function _totalShare() internal view returns(uint256) {
        return IIdleToken(idleToken).balanceOf(address(this));
    }

    /// @notice Calculates the number of shares that should be mint or burned when a user deposit or withdraw
    /// @param tokens Amount of tokens
    /// return Number of shares
    function _tokenToShares(uint256 tokens) internal view returns (uint256 shares) {
        shares = (tokens * ONE_IDLE_TOKEN) / _price();
    }

    /// @notice Calculates the number of tokens a user has in the yield source
    /// @param shares Amount of shares
    /// return Number of tokens
    function _sharesToToken(uint256 shares) internal view returns (uint256 tokens) { 
        tokens = (shares * _price()) / ONE_IDLE_TOKEN;
    }

    /// @notice Calculates the current price per share
    /// @return avg idleToken price for this contract
    function _price() internal view returns (uint256) {
      return IIdleToken(idleToken).tokenPriceWithFee(address(this));
    }

    /// @notice Deposit asset tokens to Idle
    /// @param mintAmount The amount of asset tokens to be deposited
    /// @return number of minted tokens
    function _depositToIdle(uint256 mintAmount) internal returns (uint256) {
        IERC20Upgradeable(underlyingAsset).safeTransferFrom(msg.sender, address(this), mintAmount);
        return IIdleToken(idleToken).mintIdleToken(mintAmount, false, address(0));
    }

    /// @notice Allows assets to be supplied on other user's behalf using the `to` param.
    /// @param mintAmount The amount of `token()` to be supplied
    /// @param to The user whose balance will receive the tokens
    function supplyTokenTo(uint256 mintAmount, address to) external nonReentrant override {
        uint256 mintedTokenShares = _tokenToShares(mintAmount);
        _depositToIdle(mintAmount);
        _mint(to, mintedTokenShares);
        emit SuppliedTokenTo(msg.sender, mintedTokenShares, mintAmount, to);
    }

    /// @notice Redeems tokens from the yield source from the msg.sender, it burn yield bearing tokens and return token to the sender.
    /// @param redeemAmount The amount of `token()` to withdraw.  Denominated in `token()` as above.
    /// @return redeemedUnderlyingAsset The actual amount of tokens that were redeemed.
    function redeemToken(uint256 redeemAmount) external override nonReentrant returns (uint256 redeemedUnderlyingAsset) {
        uint256 redeemedShare = _tokenToShares(redeemAmount);
        _burn(msg.sender, redeemedShare);
        redeemedUnderlyingAsset = IIdleToken(idleToken).redeemIdleToken(redeemedShare);        
        IERC20Upgradeable(underlyingAsset).safeTransfer(msg.sender, redeemedUnderlyingAsset);
        emit RedeemedToken(msg.sender, redeemedShare, redeemAmount);
    }

    /// @notice Transfer ERC20 tokens other than the idleTokens held by this contract to the recipient address
    /// @dev This function is only callable by the owner or asset manager
    /// @param erc20Token The ERC20 token to transfer
    /// @param to The recipient of the tokens
    /// @param amount The amount of tokens to transfer
    function transferERC20(address erc20Token, address to, uint256 amount) external override onlyOwnerOrAssetManager {
        require(erc20Token != idleToken, "IdleYieldSource/idleDai-transfer-not-allowed");
        IERC20Upgradeable(erc20Token).safeTransfer(to, amount);
        emit TransferredERC20(msg.sender, to, amount, erc20Token);
    }

    /// @notice Allows someone to deposit into the yield source without receiving any shares
    /// @dev This allows anyone to distribute tokens among the share holders
    /// @param amount The amount of tokens to deposit
    function sponsor(uint256 amount) external override {
        _depositToIdle(amount);
        emit Sponsored(msg.sender, amount);
    }
}