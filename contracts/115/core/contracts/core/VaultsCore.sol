// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../libraries/WadRayMath.sol";
import "../interfaces/IVaultsCore.sol";
import "../interfaces/IAddressProvider.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IVaultsCoreState.sol";
import "../liquidityMining/interfaces/IDebtNotifier.sol";

contract VaultsCore is IVaultsCore, ReentrancyGuard {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 internal constant _MAX_INT = 2**256 - 1;

  IAddressProvider public override a;
  IWETH public override WETH;
  IVaultsCoreState public override state;
  IDebtNotifier public override debtNotifier;

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender));
    _;
  }

  modifier onlyVaultOwner(uint256 _vaultId) {
    require(a.vaultsData().vaultOwner(_vaultId) == msg.sender);
    _;
  }

  constructor(
    IAddressProvider _addresses,
    IWETH _IWETH,
    IVaultsCoreState _vaultsCoreState
  ) public {
    require(address(_addresses) != address(0));
    require(address(_IWETH) != address(0));
    require(address(_vaultsCoreState) != address(0));
    a = _addresses;
    WETH = _IWETH;
    state = _vaultsCoreState;
  }

  // For a contract to receive ETH, it needs to have a payable fallback function
  // https://ethereum.stackexchange.com/a/47415
  receive() external payable {
    require(msg.sender == address(WETH));
  }

  /*
    Allow smooth upgrading of the vaultscore.
    @dev this function approves token transfers to the new vaultscore of
    both stablex and all configured collateral types
    @param _newVaultsCore address of the new vaultscore
  */
  function upgrade(address payable _newVaultsCore) public override onlyManager {
    require(address(_newVaultsCore) != address(0));
    require(a.stablex().approve(_newVaultsCore, _MAX_INT));

    for (uint256 i = 1; i <= a.config().numCollateralConfigs(); i++) {
      address collateralType = a.config().collateralConfigs(i).collateralType;
      IERC20 asset = IERC20(collateralType);
      asset.safeApprove(_newVaultsCore, _MAX_INT);
    }
  }

  /*
    Allow smooth upgrading of the VaultsCore.
    @dev this function transfers both PAR and all configured collateral
    types to the new vaultscore.
  */
  function acceptUpgrade(address payable _oldVaultsCore) public override onlyManager {
    IERC20 stableX = IERC20(a.stablex());
    stableX.safeTransferFrom(_oldVaultsCore, address(this), stableX.balanceOf(_oldVaultsCore));

    for (uint256 i = 1; i <= a.config().numCollateralConfigs(); i++) {
      address collateralType = a.config().collateralConfigs(i).collateralType;
      IERC20 asset = IERC20(collateralType);
      asset.safeTransferFrom(_oldVaultsCore, address(this), asset.balanceOf(_oldVaultsCore));
    }
  }

  /**
    Configure the debt notifier.
    @param _debtNotifier the new DebtNotifier module address.
  **/
  function setDebtNotifier(IDebtNotifier _debtNotifier) public override onlyManager {
    require(address(_debtNotifier) != address(0));
    debtNotifier = _debtNotifier;
  }

  /**
    Deposit an ERC20 token into the vault of the msg.sender as collateral
    @dev A new vault is created if no vault exists for the `msg.sender` with the specified collateral type.
    this function uses `transferFrom()` and requires pre-approval via `approve()` on the ERC20.
    @param _collateralType the address of the collateral type to be deposited
    @param _amount the amount of tokens to be deposited in WEI.
  **/
  function deposit(address _collateralType, uint256 _amount) public override {
    require(a.config().collateralIds(_collateralType) != 0);

    IERC20 asset = IERC20(_collateralType);
    asset.safeTransferFrom(msg.sender, address(this), _amount);

    _addCollateralToVault(_collateralType, _amount);
  }

  /**
    Wraps ETH and deposits WETH into the vault of the msg.sender as collateral
    @dev A new vault is created if no WETH vault exists
  **/
  function depositETH() public payable override {
    WETH.deposit{ value: msg.value }();
    _addCollateralToVault(address(WETH), msg.value);
  }

  /**
    Deposit an ERC20 token into the specified vault as collateral
    @dev this function uses `transferFrom()` and requires pre-approval via `approve()` on the ERC20.
    @param _vaultId the address of the collateral type to be deposited
    @param _amount the amount of tokens to be deposited in WEI.
  **/
  function depositByVaultId(uint256 _vaultId, uint256 _amount) public override {
    IVaultsDataProvider.Vault memory v = a.vaultsData().vaults(_vaultId);
    require(v.collateralType != address(0));

    IERC20 asset = IERC20(v.collateralType);
    asset.safeTransferFrom(msg.sender, address(this), _amount);

    _addCollateralToVaultById(_vaultId, _amount);
  }

  /**
    Wraps ETH and deposits WETH into the specified vault as collateral
    @dev this function uses `transferFrom()` and requires pre-approval via `approve()` on the ERC20.
    @param _vaultId the address of the collateral type to be deposited
  **/
  function depositETHByVaultId(uint256 _vaultId) public payable override {
    IVaultsDataProvider.Vault memory v = a.vaultsData().vaults(_vaultId);
    require(v.collateralType == address(WETH));

    WETH.deposit{ value: msg.value }();

    _addCollateralToVaultById(_vaultId, msg.value);
  }

  /**
    Deposit an ERC20 token into the vault of the msg.sender as collateral and borrows the specified amount of tokens in WEI
    @dev see deposit() and borrow()
    @param _collateralType the address of the collateral type to be deposited
    @param _depositAmount the amount of tokens to be deposited in WEI.
    @param _borrowAmount the amount of borrowed StableX tokens in WEI.
  **/
  function depositAndBorrow(
    address _collateralType,
    uint256 _depositAmount,
    uint256 _borrowAmount
  ) public override {
    deposit(_collateralType, _depositAmount);
    uint256 vaultId = a.vaultsData().vaultId(_collateralType, msg.sender);
    borrow(vaultId, _borrowAmount);
  }

  /**
    Wraps ETH and deposits WETH into the vault of the msg.sender as collateral and borrows the specified amount of tokens in WEI
    @dev see depositETH() and borrow()
    @param _borrowAmount the amount of borrowed StableX tokens in WEI.
  **/
  function depositETHAndBorrow(uint256 _borrowAmount) public payable override {
    depositETH();
    uint256 vaultId = a.vaultsData().vaultId(address(WETH), msg.sender);
    borrow(vaultId, _borrowAmount);
  }

  function _addCollateralToVault(address _collateralType, uint256 _amount) internal {
    uint256 vaultId = a.vaultsData().vaultId(_collateralType, msg.sender);
    if (vaultId == 0) {
      vaultId = a.vaultsData().createVault(_collateralType, msg.sender);
    }

    _addCollateralToVaultById(vaultId, _amount);
  }

  function _addCollateralToVaultById(uint256 _vaultId, uint256 _amount) internal {
    IVaultsDataProvider.Vault memory v = a.vaultsData().vaults(_vaultId);

    a.vaultsData().setCollateralBalance(_vaultId, v.collateralBalance.add(_amount));

    emit Deposited(_vaultId, _amount, msg.sender);
  }

  /**
    Withdraws ERC20 tokens from a vault.
    @dev Only the owner of a vault can withdraw collateral from it.
    `withdraw()` will fail if it would bring the vault below the minimum collateralization treshold.
    @param _vaultId the ID of the vault from which to withdraw the collateral.
    @param _amount the amount of ERC20 tokens to be withdrawn in WEI.
  **/
  function withdraw(uint256 _vaultId, uint256 _amount) public override onlyVaultOwner(_vaultId) nonReentrant {
    _removeCollateralFromVault(_vaultId, _amount);
    IVaultsDataProvider.Vault memory v = a.vaultsData().vaults(_vaultId);

    IERC20 asset = IERC20(v.collateralType);
    asset.safeTransfer(msg.sender, _amount);
  }

  /**
    Withdraws ETH from a WETH vault.
    @dev Only the owner of a vault can withdraw collateral from it.
    `withdraw()` will fail if it would bring the vault below the minimum collateralization treshold.
    @param _vaultId the ID of the vault from which to withdraw the collateral.
    @param _amount the amount of ETH to be withdrawn in WEI.
  **/
  function withdrawETH(uint256 _vaultId, uint256 _amount) public override onlyVaultOwner(_vaultId) nonReentrant {
    _removeCollateralFromVault(_vaultId, _amount);
    IVaultsDataProvider.Vault memory v = a.vaultsData().vaults(_vaultId);

    require(v.collateralType == address(WETH));

    WETH.withdraw(_amount);
    msg.sender.transfer(_amount);
  }

  function _removeCollateralFromVault(uint256 _vaultId, uint256 _amount) internal {
    IVaultsDataProvider.Vault memory v = a.vaultsData().vaults(_vaultId);
    require(_amount <= v.collateralBalance);
    uint256 newCollateralBalance = v.collateralBalance.sub(_amount);
    a.vaultsData().setCollateralBalance(_vaultId, newCollateralBalance);
    if (v.baseDebt > 0) {
      // Save gas cost when withdrawing from 0 debt vault
      state.refreshCollateral(v.collateralType);
      uint256 newCollateralValue = a.priceFeed().convertFrom(v.collateralType, newCollateralBalance);
      require(
        a.liquidationManager().isHealthy(
          newCollateralValue,
          a.vaultsData().vaultDebt(_vaultId),
          a.config().collateralConfigs(a.config().collateralIds(v.collateralType)).minCollateralRatio
        )
      );
    }

    emit Withdrawn(_vaultId, _amount, msg.sender);
  }

  /**
    Borrow new PAR tokens from a vault.
    @dev Only the owner of a vault can borrow from it.
    `borrow()` will update the outstanding vault debt to the current time before attempting the withdrawal.
     `borrow()` will fail if it would bring the vault below the minimum collateralization treshold.
    @param _vaultId the ID of the vault from which to borrow.
    @param _amount the amount of borrowed PAR tokens in WEI.
  **/
  function borrow(uint256 _vaultId, uint256 _amount) public override onlyVaultOwner(_vaultId) nonReentrant {
    IVaultsDataProvider.Vault memory v = a.vaultsData().vaults(_vaultId);

    // Make sure current rate is up to date
    state.refreshCollateral(v.collateralType);

    uint256 originationFeePercentage = a.config().collateralOriginationFee(v.collateralType);
    uint256 newDebt = _amount;
    if (originationFeePercentage > 0) {
      newDebt = newDebt.add(_amount.wadMul(originationFeePercentage));
    }

    // Increment vault borrow balance
    uint256 newBaseDebt = a.ratesManager().calculateBaseDebt(newDebt, cumulativeRates(v.collateralType));

    a.vaultsData().setBaseDebt(_vaultId, v.baseDebt.add(newBaseDebt));

    uint256 collateralValue = a.priceFeed().convertFrom(v.collateralType, v.collateralBalance);
    uint256 newVaultDebt = a.vaultsData().vaultDebt(_vaultId);

    require(a.vaultsData().collateralDebt(v.collateralType) <= a.config().collateralDebtLimit(v.collateralType));

    bool isHealthy = a.liquidationManager().isHealthy(
      collateralValue,
      newVaultDebt,
      a.config().collateralConfigs(a.config().collateralIds(v.collateralType)).minCollateralRatio
    );
    require(isHealthy);

    a.stablex().mint(msg.sender, _amount);
    debtNotifier.debtChanged(_vaultId);
    emit Borrowed(_vaultId, _amount, msg.sender);
  }

  /**
    Convenience function to repay all debt of a vault
    @dev `repayAll()` will update the outstanding vault debt to the current time.
    @param _vaultId the ID of the vault for which to repay the debt.
  **/
  function repayAll(uint256 _vaultId) public override {
    repay(_vaultId, _MAX_INT);
  }

  /**
    Repay an outstanding PAR balance to a vault.
    @dev `repay()` will update the outstanding vault debt to the current time.
    @param _vaultId the ID of the vault for which to repay the outstanding debt balance.
    @param _amount the amount of PAR tokens in WEI to be repaid.
  **/
  function repay(uint256 _vaultId, uint256 _amount) public override nonReentrant {
    address collateralType = a.vaultsData().vaultCollateralType(_vaultId);

    // Make sure current rate is up to date
    state.refreshCollateral(collateralType);

    uint256 currentVaultDebt = a.vaultsData().vaultDebt(_vaultId);
    // Decrement vault borrow balance
    if (_amount >= currentVaultDebt) {
      //full repayment
      _amount = currentVaultDebt; //only pay back what's outstanding
    }
    _reduceVaultDebt(_vaultId, _amount);
    a.stablex().burn(msg.sender, _amount);
    debtNotifier.debtChanged(_vaultId);
    emit Repaid(_vaultId, _amount, msg.sender);
  }

  /**
    Internal helper function to reduce the debt of a vault.
    @dev assumes cumulative rates for the vault's collateral type are up to date.
    please call `refreshCollateral()` before calling this function.
    @param _vaultId the ID of the vault for which to reduce the debt.
    @param _amount the amount of debt to be reduced.
  **/
  function _reduceVaultDebt(uint256 _vaultId, uint256 _amount) internal {
    address collateralType = a.vaultsData().vaultCollateralType(_vaultId);

    uint256 currentVaultDebt = a.vaultsData().vaultDebt(_vaultId);
    uint256 remainder = currentVaultDebt.sub(_amount);
    uint256 cumulativeRate = cumulativeRates(collateralType);

    if (remainder == 0) {
      a.vaultsData().setBaseDebt(_vaultId, 0);
    } else {
      uint256 newBaseDebt = a.ratesManager().calculateBaseDebt(remainder, cumulativeRate);
      a.vaultsData().setBaseDebt(_vaultId, newBaseDebt);
    }
  }

  /**
    Liquidate a vault that is below the liquidation treshold by repaying its outstanding debt.
    @dev `liquidate()` will update the outstanding vault debt to the current time and pay a `liquidationBonus`
    to the liquidator. `liquidate()` can be called by anyone.
    @param _vaultId the ID of the vault to be liquidated.
  **/
  function liquidate(uint256 _vaultId) public override {
    liquidatePartial(_vaultId, _MAX_INT);
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
    IVaultsDataProvider.Vault memory v = a.vaultsData().vaults(_vaultId);

    state.refreshCollateral(v.collateralType);

    uint256 collateralValue = a.priceFeed().convertFrom(v.collateralType, v.collateralBalance);
    uint256 currentVaultDebt = a.vaultsData().vaultDebt(_vaultId);

    require(
      !a.liquidationManager().isHealthy(
        collateralValue,
        currentVaultDebt,
        a.config().collateralConfigs(a.config().collateralIds(v.collateralType)).liquidationRatio
      )
    );

    uint256 repaymentAfterLiquidationFeeRatio = WadRayMath.wad().sub(
      a.config().collateralLiquidationFee(v.collateralType)
    );
    uint256 maxLiquiditionCost = currentVaultDebt.wadDiv(repaymentAfterLiquidationFeeRatio);

    uint256 repayAmount;

    if (_amount > maxLiquiditionCost) {
      _amount = maxLiquiditionCost;
      repayAmount = currentVaultDebt;
    } else {
      repayAmount = _amount.wadMul(repaymentAfterLiquidationFeeRatio);
    }

    // collateral value to be received by the liquidator is based on the total amount repaid (including the liquidationFee).
    uint256 collateralValueToReceive = _amount.add(a.liquidationManager().liquidationBonus(v.collateralType, _amount));
    uint256 insuranceAmount = 0;
    if (collateralValueToReceive >= collateralValue) {
      // Not enough collateral for debt & liquidation fee
      collateralValueToReceive = collateralValue;
      uint256 discountedCollateralValue = a.liquidationManager().applyLiquidationDiscount(
        v.collateralType,
        collateralValue
      );

      if (currentVaultDebt > discountedCollateralValue) {
        // Not enough collateral for debt alone
        insuranceAmount = currentVaultDebt.sub(discountedCollateralValue);
        require(a.stablex().balanceOf(address(this)) >= insuranceAmount);
        a.stablex().burn(address(this), insuranceAmount); // Insurance uses local reserves to pay down debt
        emit InsurancePaid(_vaultId, insuranceAmount, msg.sender);
      }

      repayAmount = currentVaultDebt.sub(insuranceAmount);
      _amount = discountedCollateralValue;
    }

    // reduce the vault debt by repayAmount
    _reduceVaultDebt(_vaultId, repayAmount.add(insuranceAmount));
    a.stablex().burn(msg.sender, _amount);

    // send the claimed collateral to the liquidator
    uint256 collateralToReceive = a.priceFeed().convertTo(v.collateralType, collateralValueToReceive);
    a.vaultsData().setCollateralBalance(_vaultId, v.collateralBalance.sub(collateralToReceive));
    IERC20 asset = IERC20(v.collateralType);
    asset.safeTransfer(msg.sender, collateralToReceive);

    debtNotifier.debtChanged(_vaultId);

    emit Liquidated(_vaultId, repayAmount, collateralToReceive, v.owner, msg.sender);
  }

  /**
    Returns the cumulativeRate of a collateral type. This function exists for
    backwards compatibility with the VaultsDataProvider.
    @param _collateralType the address of the collateral type.
  **/
  function cumulativeRates(address _collateralType) public view override returns (uint256) {
    return state.cumulativeRates(_collateralType);
  }
}
