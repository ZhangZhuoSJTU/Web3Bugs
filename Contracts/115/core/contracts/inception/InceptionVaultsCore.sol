//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "./BoringOwnable.sol";
import "./interfaces/IInceptionVaultsCore.sol";
import "./interfaces/IAdminInceptionVault.sol";
import "./interfaces/IInceptionVaultsDataProvider.sol";
import "./interfaces/IInceptionVaultPriceFeed.sol";
import "../interfaces/IAddressProvider.sol";
import "../libraries/WadRayMath.sol";

contract InceptionVaultsCore is IInceptionVaultsCore, BoringOwnable, ReentrancyGuard, Initializable {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using WadRayMath for uint256;

  uint256 internal constant _MAX_INT = 2**256 - 1;

  uint256 private _cumulativeRate;
  uint256 private _lastRefresh;
  VaultConfig private _vaultConfig;

  IAddressProvider private _a;
  IERC20 private _inceptionCollateral;
  IAdminInceptionVault private _adminInceptionVault;
  IInceptionVaultsDataProvider private _inceptionVaultsData;
  IInceptionVaultPriceFeed private _inceptionPriceFeed;

  modifier onlyVaultOwner(uint256 _vaultId) {
    require(_inceptionVaultsData.vaultOwner(_vaultId) == msg.sender, "IV010");
    _;
  }

  function initialize(
    address _owner,
    VaultConfig memory vaultConfig,
    IERC20 inceptionCollateral,
    IAddressProvider addressProvider,
    IAdminInceptionVault adminInceptionVault,
    IInceptionVaultsDataProvider inceptionVaultsDataProvider,
    IInceptionVaultPriceFeed inceptionPriceFeed
  ) external override initializer {
    _vaultConfig = vaultConfig;
    _inceptionCollateral = inceptionCollateral;
    _lastRefresh = block.timestamp;
    _cumulativeRate = WadRayMath.ray();
    _a = addressProvider;
    _adminInceptionVault = adminInceptionVault;
    _inceptionVaultsData = inceptionVaultsDataProvider;
    owner = _owner;
    _inceptionPriceFeed = inceptionPriceFeed;
  }

  /**
    Deposit inceptionCollateral ERC20 token into the specified vault as collateral
    @dev this function uses `transferFrom()` and requires pre-approval via `approve()` on the ERC20.
    @param _vaultId the ID of the vault in which to deposit the inceptioCollateral.
    @param _amount the amount of tokens to be deposited in WEI.
  **/
  function depositByVaultId(uint256 _vaultId, uint256 _amount) external override {
    _inceptionCollateral.safeTransferFrom(msg.sender, address(this), _amount);

    _addCollateralToVaultById(_vaultId, _amount);
  }

  /**
    Deposit inceptionCollateral ERC20 token into the vault of the msg.sender as collateral and borrows the specified amount of tokens in WEI
    @dev see deposit() and borrow()
    @param _depositAmount the amount of inceptionCollateral to be deposited in WEI.
    @param _borrowAmount the amount of borrowed StableX tokens in WEI.
  **/
  function depositAndBorrow(uint256 _depositAmount, uint256 _borrowAmount) external override {
    deposit(_depositAmount);
    uint256 vaultId = _inceptionVaultsData.vaultId(msg.sender);
    borrow(vaultId, _borrowAmount);
  }

  /**
    Withdraws inceptionCollateral ERC20 token from a vault.
    @dev Only the owner of a vault can withdraw collateral from it.
    `withdraw()` will fail if it would bring the vault below the minimum collateralization treshold.
    @param _vaultId the ID of the vault from which to withdraw the inceptionCollateral.
    @param _amount the amount of inceptionCollateral ERC20 tokens to be withdrawn in WEI.
  **/
  function withdraw(uint256 _vaultId, uint256 _amount) external override onlyVaultOwner(_vaultId) nonReentrant {
    _removeCollateralFromVault(_vaultId, _amount);
    _inceptionCollateral.safeTransfer(msg.sender, _amount);
  }

  /**
    Convenience function to repay all debt of a vault
    @dev `repayAll()` will update the outstanding vault debt to the current time.
    @param _vaultId the ID of the vault for which to repay the debt.
  **/
  function repayAll(uint256 _vaultId) external override {
    repay(_vaultId, _MAX_INT);
  }

  /**
    Liquidate a vault that is below the liquidation treshold by repaying its outstanding debt.
    @dev `liquidate()` will update the outstanding vault debt to the current time and pay a `liquidationBonus`
    to the liquidator. `liquidate()` can be called by anyone.
    @param _vaultId the ID of the vault to be liquidated.
  **/
  function liquidate(uint256 _vaultId) external override {
    liquidatePartial(_vaultId, _MAX_INT);
  }

  /**
    Deposit inceptionCollateral ERC20 token into the vault of the msg.sender as collateral
    @dev A new vault is created if no vault exists for the `msg.sender` with the specified collateral type.
    this function uses `transferFrom()` and requires pre-approval via `approve()` on the ERC20.
    @param _amount the amount of tokens to be deposited in WEI.
  **/
  function deposit(uint256 _amount) public override {
    require(_amount > 0, "IV100");
    _inceptionCollateral.safeTransferFrom(msg.sender, address(this), _amount);

    _addCollateralToVault(_amount);
  }

  /**
    Borrow new PAR tokens from a vault.
    @dev Only the owner of a vault can borrow from it.
    `borrow()` will update the outstanding vault debt to the current time before attempting the withdrawal.
     `borrow()` will fail if it would bring the vault below the minimum collateralization treshold.
    @param _vaultId the ID of the vault from which to borrow.
    @param _amount the amount of borrowed inceptionCollateral tokens in WEI.
  **/
  function borrow(uint256 _vaultId, uint256 _amount) public override onlyVaultOwner(_vaultId) nonReentrant {
    IERC20 stablex = IERC20(_a.stablex());
    require(_amount <= stablex.balanceOf(address(_adminInceptionVault)), "IV104");
    IInceptionVaultsDataProvider.InceptionVault memory v = _inceptionVaultsData.vaults(_vaultId);

    // Make sure current rate is up to date
    _refreshCumulativeRate();

    uint256 newDebt = _amount;
    if (_vaultConfig.originationFee > 0) {
      newDebt = newDebt.add(_amount.wadMul(_vaultConfig.originationFee));
    }

    // Increment vault borrow balance

    uint256 newBaseDebt = _a.ratesManager().calculateBaseDebt(newDebt, _cumulativeRate);

    _inceptionVaultsData.setBaseDebt(_vaultId, v.baseDebt.add(newBaseDebt));

    uint256 collateralValue = _inceptionPriceFeed.convertFrom(v.collateralBalance);
    uint256 newVaultDebt = _inceptionVaultsData.vaultDebt(_vaultId);

    bool isHealthy = _a.liquidationManager().isHealthy(collateralValue, newVaultDebt, _vaultConfig.minCollateralRatio);

    require(isHealthy, "IV102");

    _adminInceptionVault.lendPAR(_amount, msg.sender);

    emit Borrowed(_vaultId, _amount, msg.sender);
  }

  /**
    Repay an outstanding PAR balance to a vault.
    @dev `repay()` will update the outstanding vault debt to the current time.
    @param _vaultId the ID of the vault for which to repay the outstanding debt balance.
    @param _amount the amount of PAR tokens in WEI to be repaid.
  **/
  function repay(uint256 _vaultId, uint256 _amount) public override nonReentrant {
    // Make sure current rate is up to date
    _refreshCumulativeRate();

    uint256 currentVaultDebt = _inceptionVaultsData.vaultDebt(_vaultId);
    // Decrement vault borrow balance
    if (_amount >= currentVaultDebt) {
      // Full repayment
      _amount = currentVaultDebt; //only pay back what's outstanding
    }
    _reduceVaultDebt(_vaultId, _amount);
    // This will require a user allowance first
    IERC20 stablex = IERC20(_a.stablex());
    stablex.safeTransferFrom(msg.sender, address(_adminInceptionVault), _amount);
    emit Repaid(_vaultId, _amount, msg.sender);
  }

  /**
    Liquidate a vault partially that is below the liquidation treshold by repaying part of its outstanding debt.
    @dev `liquidatePartial()` will update the outstanding vault debt to the current time and pay a `liquidationBonus`
    to the liquidator. A LiquidationFee will be applied to the borrower during the liquidation.
    This means that the change in outstanding debt can be smaller than the repaid amount.
    `liquidatePartial()` can be called by anyone.
    @param _vaultId the ID of the vault to be liquidated.
    @param _amount the amount of debt+liquidationFee to repay.
  **/
  function liquidatePartial(uint256 _vaultId, uint256 _amount) public override nonReentrant {
    IInceptionVaultsDataProvider.InceptionVault memory v = _inceptionVaultsData.vaults(_vaultId);
    _refreshCumulativeRate();
    uint256 collateralValue = _inceptionPriceFeed.convertFrom(v.collateralBalance);
    uint256 currentVaultDebt = _inceptionVaultsData.vaultDebt(_vaultId);
    require(
      !_a.liquidationManager().isHealthy(collateralValue, currentVaultDebt, _vaultConfig.liquidationRatio),
      "IV103"
    );
    uint256 repaymentAfterLiquidationFeeRatio = WadRayMath.wad().sub(_vaultConfig.liquidationFee);
    uint256 maxLiquidationCost = currentVaultDebt.wadDiv(repaymentAfterLiquidationFeeRatio);
    uint256 repayAmount;
    if (_amount > maxLiquidationCost) {
      _amount = maxLiquidationCost;
      repayAmount = currentVaultDebt;
    } else {
      repayAmount = _amount.wadMul(repaymentAfterLiquidationFeeRatio);
    }
    uint256 collateralValueToReceive = _amount.add(_amount.wadMul(_vaultConfig.liquidationBonus));
    uint256 insuranceAmount = 0;
    if (collateralValueToReceive >= collateralValue) {
      // Not enough collateral for debt & liquidation bonus
      collateralValueToReceive = collateralValue;
      uint256 discountedCollateralValue = collateralValue.wadDiv(_vaultConfig.liquidationBonus.add(WadRayMath.wad()));
      if (currentVaultDebt > discountedCollateralValue) {
        // Not enough collateral for debt alone
        insuranceAmount = currentVaultDebt.sub(discountedCollateralValue);
        require(_a.stablex().balanceOf(address(_adminInceptionVault)) >= insuranceAmount, "IV104");
      }
      repayAmount = currentVaultDebt.sub(insuranceAmount);
      _amount = discountedCollateralValue;
    }
    // Reduce the vault debt by repayAmount
    _reduceVaultDebt(_vaultId, repayAmount.add(insuranceAmount));
    IERC20 stablex = IERC20(_a.stablex());
    stablex.safeTransferFrom(msg.sender, address(this), _amount);
    stablex.safeTransfer(address(_adminInceptionVault), _amount);
    // Send the claimed collateral to the liquidator
    uint256 collateralToReceive = _inceptionPriceFeed.convertTo(collateralValueToReceive);
    _inceptionVaultsData.setCollateralBalance(_vaultId, v.collateralBalance.sub(collateralToReceive));
    _inceptionCollateral.safeTransfer(msg.sender, collateralToReceive);
    emit Liquidated(_vaultId, repayAmount, collateralToReceive, v.owner, msg.sender);
  }

  function cumulativeRate() public view override returns (uint256) {
    return _cumulativeRate;
  }

  function lastRefresh() public view override returns (uint256) {
    return _lastRefresh;
  }

  function vaultConfig() public view override returns (VaultConfig memory) {
    return _vaultConfig;
  }

  function a() public view override returns (IAddressProvider) {
    return _a;
  }

  function inceptionCollateral() public view override returns (IERC20) {
    return _inceptionCollateral;
  }

  function adminInceptionVault() public view override returns (IAdminInceptionVault) {
    return _adminInceptionVault;
  }

  function inceptionVaultsData() public view override returns (IInceptionVaultsDataProvider) {
    return _inceptionVaultsData;
  }

  function inceptionPriceFeed() public view override returns (IInceptionVaultPriceFeed) {
    return _inceptionPriceFeed;
  }

  function _addCollateralToVault(uint256 _amount) internal {
    uint256 vaultId = _inceptionVaultsData.vaultId(msg.sender);
    if (vaultId == 0) {
      vaultId = _inceptionVaultsData.createVault(msg.sender);
    }
    _addCollateralToVaultById(vaultId, _amount);
  }

  function _removeCollateralFromVault(uint256 _vaultId, uint256 _amount) internal {
    IInceptionVaultsDataProvider.InceptionVault memory v = _inceptionVaultsData.vaults(_vaultId);
    require(_amount <= v.collateralBalance, "IV101");
    uint256 newCollateralBalance = v.collateralBalance.sub(_amount);
    _inceptionVaultsData.setCollateralBalance(_vaultId, newCollateralBalance);
    if (v.baseDebt > 0) {
      _refreshCumulativeRate();
      uint256 newCollateralValue = _inceptionPriceFeed.convertFrom(newCollateralBalance);
      require(
        _a.liquidationManager().isHealthy(
          newCollateralValue,
          _inceptionVaultsData.vaults(_vaultId).baseDebt,
          _vaultConfig.minCollateralRatio
        ),
        "IV102"
      );
    }

    emit Withdrawn(_vaultId, _amount, msg.sender);
  }

  function _addCollateralToVaultById(uint256 _vaultId, uint256 _amount) internal {
    IInceptionVaultsDataProvider.InceptionVault memory v = _inceptionVaultsData.vaults(_vaultId);
    _inceptionVaultsData.setCollateralBalance(_vaultId, v.collateralBalance.add(_amount));
    emit Deposited(_vaultId, _amount, msg.sender);
  }

  function _refreshCumulativeRate() internal {
    uint256 timestamp = block.timestamp;
    uint256 _timeElapsed = block.timestamp.sub(_lastRefresh);
    _cumulativeRate = _a.ratesManager().calculateCumulativeRate(_vaultConfig.borrowRate, _cumulativeRate, _timeElapsed);
    _lastRefresh = timestamp;
    emit CumulativeRateUpdated(_timeElapsed, _cumulativeRate);
  }

  /**
    Internal helper function to reduce the debt of a vault.
    @dev assumes cumulative rates for the vault's collateral type are up to date.
    please call `refreshCollateral()` before calling this function.
    @param _vaultId the ID of the vault for which to reduce the debt.
    @param _amount the amount of debt to be reduced.
  **/
  function _reduceVaultDebt(uint256 _vaultId, uint256 _amount) internal {
    uint256 currentVaultDebt = _inceptionVaultsData.vaultDebt(_vaultId);
    uint256 remainder = currentVaultDebt.sub(_amount);

    if (remainder == 0) {
      _inceptionVaultsData.setBaseDebt(_vaultId, 0);
    } else {
      uint256 newBaseDebt = _a.ratesManager().calculateBaseDebt(remainder, _cumulativeRate);
      _inceptionVaultsData.setBaseDebt(_vaultId, newBaseDebt);
    }
  }
}
