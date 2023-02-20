// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.7.6;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@pooltogether/yield-source-interface/contracts/IYieldSource.sol";

import "./access/AssetManager.sol";

/// @title Swappable yield source contract to allow a PoolTogether prize pool to swap between different yield sources.
/// @dev This contract adheres to the PoolTogether yield source interface.
/// @dev This contract inherits AssetManager which extends OwnableUpgradable.
/// @notice Swappable yield source for a PoolTogether prize pool that generates yield by depositing into the specified yield source.
contract SwappableYieldSource is ERC20Upgradeable, IYieldSource, AssetManager, ReentrancyGuardUpgradeable {
  using SafeMathUpgradeable for uint256;
  using SafeERC20Upgradeable for IERC20Upgradeable;

  /// @notice Emitted when the swappable yield source is initialized.
  /// @param yieldSource Address of yield source used to initialize this swappable yield source.
  /// @param decimals Number of decimals the shares (inherited ERC20) will have.  Same as underlying asset to ensure same ExchangeRates.
  /// @param symbol Token symbol for the underlying ERC20 shares (eg: sysDAI).
  /// @param name Token name for the underlying ERC20 shares (eg: PoolTogether Swappable Yield Source DAI).
  /// @param owner Swappable yield source owner.
  event SwappableYieldSourceInitialized(
    IYieldSource indexed yieldSource,
    uint8 decimals,
    string symbol,
    string name,
    address indexed owner
  );

  /// @notice Emitted when a yield source has been successfuly set.
  /// @param yieldSource Yield source address that was set.
  event SwappableYieldSourceSet(
    IYieldSource indexed yieldSource
  );

  /// @notice Emitted when funds are successfully transferred from specified yield source to current yield source.
  /// @param yieldSource Yield source address that provided funds.
  /// @param amount Amount of funds transferred.
  event FundsTransferred(
    IYieldSource indexed yieldSource,
    uint256 amount
  );

  /// @notice Emitted when ERC20 tokens other than yield source's tokens are withdrawn from the swappable yield source.
  /// @param from Address that transferred funds.
  /// @param to Address that received funds.
  /// @param amount Amount of tokens transferred.
  /// @param token ERC20 token transferred.
  event TransferredERC20(
    address indexed from,
    address indexed to,
    uint256 amount,
    IERC20Upgradeable indexed token
  );

  /// @notice Yield source interface.
  IYieldSource public yieldSource;

  /// @notice Mock Initializer to initialize implementations used by minimal proxies.
  function freeze() public initializer {
    //no-op
  }

  /// @notice Hack to determine if address passed is an actual yield source.
  /// @dev If depositTokenAddressData.length is not superior to 0, then staticcall didn't return any data.
  /// @param _yieldSource Yield source address to check.
  function _requireYieldSource(IYieldSource _yieldSource) internal view {
    require(address(_yieldSource) != address(0), "SwappableYieldSource/yieldSource-not-zero-address");

    (, bytes memory depositTokenAddressData) = address(_yieldSource).staticcall(abi.encode(_yieldSource.depositToken.selector));

    bool isInvalidYieldSource;

    if (depositTokenAddressData.length > 0) {
      (address depositTokenAddress) = abi.decode(depositTokenAddressData, (address));

      isInvalidYieldSource = depositTokenAddress != address(0);
    }

    require(isInvalidYieldSource, "SwappableYieldSource/invalid-yield-source");
  }

  /// @notice Initializes the swappable yield source with the yieldSource address provided.
  /// @dev We approve yieldSource to spend maxUint256 amount of depositToken (eg: DAI), to save gas for future calls.
  /// @param _yieldSource Yield source address used to initialize this swappable yield source.
  /// @param _decimals Number of decimals the shares (inherited ERC20) will have.  Same as underlying asset to ensure same ExchangeRates.
  /// @param _symbol Token symbol for the underlying ERC20 shares (eg: sysDAI).
  /// @param _name Token name for the underlying ERC20 shares (eg: PoolTogether Swappable Yield Source DAI).
  /// @param _owner Swappable yield source owner.
  /// @return true if operation is successful.
  function initialize(
    IYieldSource _yieldSource,
    uint8 _decimals,
    string calldata _symbol,
    string calldata _name,
    address _owner
  ) public initializer returns (bool) {
    _requireYieldSource(_yieldSource);
    yieldSource = _yieldSource;

    __Ownable_init();

    require(_owner != address(0), "SwappableYieldSource/owner-not-zero-address");
    transferOwnership(_owner);

    __ReentrancyGuard_init();

    __ERC20_init(_name, _symbol);
    require(_decimals > 0, "SwappableYieldSource/decimals-gt-zero");
    _setupDecimals(_decimals);

    IERC20Upgradeable(_yieldSource.depositToken()).safeApprove(address(_yieldSource), type(uint256).max);

    emit SwappableYieldSourceInitialized(
      _yieldSource,
      _decimals,
      _symbol,
      _name,
      _owner
    );

    return true;
  }

  /// @notice Approve yieldSource to spend maxUint256 amount of depositToken (eg: DAI).
  /// @dev Emergency function to re-approve max amount if approval amount dropped too low.
  /// @return true if operation is successful.
  function approveMaxAmount() external onlyOwner returns (bool) {
    IYieldSource _yieldSource = yieldSource;
    IERC20Upgradeable _depositToken = IERC20Upgradeable(_yieldSource.depositToken());

    uint256 allowance = _depositToken.allowance(address(this), address(_yieldSource));
    _depositToken.safeIncreaseAllowance(address(_yieldSource), type(uint256).max.sub(allowance));

    return true;
  }

  /// @notice Calculates the number of shares that should be minted or burned when a user deposit or withdraw.
  /// @param tokens Amount of tokens.
  /// @return Number of shares.
  function _tokenToShares(uint256 tokens) internal returns (uint256) {
    uint256 shares;
    uint256 _totalSupply = totalSupply();

    if (_totalSupply == 0) {
      shares = tokens;
    } else {
      // rate = tokens / shares
      // shares = tokens * (totalShares / swappableYieldSourceTotalSupply)
      uint256 exchangeMantissa = FixedPoint.calculateMantissa(_totalSupply, yieldSource.balanceOfToken(address(this)));
      shares = FixedPoint.multiplyUintByMantissa(tokens, exchangeMantissa);
    }

    return shares;
  }

  /// @notice Calculates the number of tokens a user has in the yield source.
  /// @param shares Amount of shares.
  /// @return Number of tokens.
  function _sharesToToken(uint256 shares) internal returns (uint256) {
    uint256 tokens;
    uint256 _totalSupply = totalSupply();

    if (_totalSupply == 0) {
      tokens = shares;
    } else {
      // tokens = shares * (yieldSourceTotalSupply / totalShares)
      uint256 exchangeMantissa = FixedPoint.calculateMantissa(yieldSource.balanceOfToken(address(this)), _totalSupply);
      tokens = FixedPoint.multiplyUintByMantissa(shares, exchangeMantissa);
    }

    return tokens;
  }

  /// @notice Mint tokens to the user.
  /// @dev Shares corresponding to the number of tokens supplied are minted to user's balance.
  /// @param mintAmount Amount of asset tokens to be minted.
  /// @param to User whose balance will receive the tokens.
  function _mintShares(uint256 mintAmount, address to) internal {
    uint256 shares = _tokenToShares(mintAmount);

    require(shares > 0, "SwappableYieldSource/shares-gt-zero");

    _mint(to, shares);
  }

  /// @notice Burn shares from user's balance.
  /// @dev Shares corresponding to the number of tokens withdrawn are burnt from user's balance.
  /// @param burnAmount Amount of asset tokens to be burnt.
  function _burnShares(uint256 burnAmount) internal {
    uint256 shares = _tokenToShares(burnAmount);
    _burn(msg.sender, shares);
  }

  /// @notice Supplies tokens to the current yield source.  Allows assets to be supplied on other user's behalf using the `to` param.
  /// @dev Asset tokens are supplied to the yield source, then deposited into the underlying yield source (eg: Aave, Compound, etc...).
  /// @dev Shares from the yield source are minted to the swappable yield source address (this contract).
  /// @dev Shares from the swappable yield source are minted to the `to` address.
  /// @param amount Amount of `depositToken()` to be supplied.
  /// @param to User whose balance will receive the tokens.
  function supplyTokenTo(uint256 amount, address to) external override nonReentrant {
    IERC20Upgradeable _depositToken = IERC20Upgradeable(yieldSource.depositToken());

    _depositToken.safeTransferFrom(msg.sender, address(this), amount);
    yieldSource.supplyTokenTo(amount, address(this));

    _mintShares(amount, to);
  }

  /// @notice Returns the ERC20 asset token used for deposits.
  /// @return ERC20 asset token address.
  function depositToken() public view override returns (address) {
    return yieldSource.depositToken();
  }

  /// @notice Returns the total balance in swappable tokens (eg: swsDAI).
  /// @return Underlying balance of swappable tokens.
  function balanceOfToken(address addr) external override returns (uint256) {
    return _sharesToToken(balanceOf(addr));
  }

  /// @notice Redeems tokens from the current yield source.
  /// @dev Shares of the swappable yield source address (this contract) are burnt from the yield source.
  /// @dev Shares of the `msg.sender` address are burnt from the swappable yield source.
  /// @param amount Amount of `depositToken()` to withdraw.
  /// @return Actual amount of tokens that were redeemed.
  function redeemToken(uint256 amount) external override nonReentrant returns (uint256) {
    IERC20Upgradeable _depositToken = IERC20Upgradeable(yieldSource.depositToken());

    _burnShares(amount);

    uint256 redeemableBalance = yieldSource.redeemToken(amount);
    _depositToken.safeTransferFrom(address(this), msg.sender, redeemableBalance);

    return redeemableBalance;
  }

  /// @notice Determine if passed yield source is different from current yield source.
  /// @param _yieldSource Yield source address to check.
  function _requireDifferentYieldSource(IYieldSource _yieldSource) internal view {
    require(address(_yieldSource) != address(yieldSource), "SwappableYieldSource/same-yield-source");
  }

  /// @notice Set new yield source.
  /// @dev After setting the new yield source, we need to approve it to spend maxUint256 amount of depositToken (eg: DAI).
  /// @param _newYieldSource New yield source address to set.
  function _setYieldSource(IYieldSource _newYieldSource) internal {
    _requireDifferentYieldSource(_newYieldSource);
    require(_newYieldSource.depositToken() == yieldSource.depositToken(), "SwappableYieldSource/different-deposit-token");

    yieldSource = _newYieldSource;
    IERC20Upgradeable(_newYieldSource.depositToken()).safeApprove(address(_newYieldSource), type(uint256).max);

    emit SwappableYieldSourceSet(_newYieldSource);
  }

  /// @notice Set new yield source.
  /// @dev This function is only callable by the owner or asset manager.
  /// @param _newYieldSource New yield source address to set.
  /// @return true if operation is successful.
  function setYieldSource(IYieldSource _newYieldSource) external onlyOwnerOrAssetManager returns (bool) {
    _setYieldSource(_newYieldSource);
    return true;
  }

  /// @notice Transfer funds from specified yield source to current yield source.
  /// @dev We check that the `currentBalance` transferred is at least equal or superior to the `amount` requested.
  /// @dev `currentBalance` can be superior to `amount` if yield has been accruing between redeeming and checking for a mathematical error.
  /// @param _yieldSource Yield source address to transfer funds from.
  /// @param _amount Amount of funds to transfer from passed yield source to current yield source.
  function _transferFunds(IYieldSource _yieldSource, uint256 _amount) internal {
    IYieldSource _currentYieldSource = yieldSource;

    _yieldSource.redeemToken(_amount);
    uint256 currentBalance = IERC20Upgradeable(_yieldSource.depositToken()).balanceOf(address(this));

    require(_amount <= currentBalance, "SwappableYieldSource/transfer-amount-different");

    _currentYieldSource.supplyTokenTo(currentBalance, address(this));

    emit FundsTransferred(_yieldSource, _amount);
  }

  /// @notice Transfer funds from specified yield source to current yield source.
  /// @dev We only verify it is a different yield source in the public function cause we already check for it in `_setYieldSource` function.
  /// @param _yieldSource Yield source address to transfer funds from.
  /// @param amount Amount of funds to transfer from passed yield source to current yield source.
  /// @return true if operation is successful.
  function transferFunds(IYieldSource _yieldSource, uint256 amount) external onlyOwnerOrAssetManager returns (bool) {
    _requireDifferentYieldSource(_yieldSource);
    _transferFunds(_yieldSource, amount);
    return true;
  }

  /// @notice Swap current yield source for new yield source.
  /// @dev This function is only callable by the owner or asset manager.
  /// @dev We set a new yield source and then transfer funds from the now previous yield source to the new current yield source.
  /// @param _newYieldSource New yield source address to set and transfer funds to.
  /// @return true if operation is successful.
  function swapYieldSource(IYieldSource _newYieldSource) external onlyOwnerOrAssetManager returns (bool) {
    IYieldSource _currentYieldSource = yieldSource;
    uint256 balance = _currentYieldSource.balanceOfToken(address(this));

    _setYieldSource(_newYieldSource);
    _transferFunds(_currentYieldSource, balance);

    return true;
  }

  /// @notice Transfer ERC20 tokens other than the yield source's tokens held by this contract to the recipient address.
  /// @dev This function is only callable by the owner or asset manager.
  /// @param erc20Token ERC20 token to transfer.
  /// @param to Recipient of the tokens.
  /// @param amount Amount of tokens to transfer.
  /// @return true if operation is successful.
  function transferERC20(IERC20Upgradeable erc20Token, address to, uint256 amount) external onlyOwnerOrAssetManager returns (bool) {
    require(address(erc20Token) != address(yieldSource), "SwappableYieldSource/yield-source-token-transfer-not-allowed");
    erc20Token.safeTransfer(to, amount);
    emit TransferredERC20(msg.sender, to, amount, erc20Token);
    return true;
  }
}
