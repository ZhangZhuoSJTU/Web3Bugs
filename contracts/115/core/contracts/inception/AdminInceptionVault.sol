//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "./BoringOwnable.sol";
import "./interfaces/IAdminInceptionVault.sol";
import "./interfaces/IInceptionVaultsCore.sol";
import "../interfaces/IAddressProvider.sol";
import "../interfaces/IVaultsDataProvider.sol";
import "../interfaces/IWETH.sol";
import "../liquidityMining/interfaces/IDebtNotifier.sol";
import "../liquidityMining/interfaces/IGenericMiner.sol";

contract AdminInceptionVault is IAdminInceptionVault, BoringOwnable, Initializable {
  using SafeERC20 for IERC20;

  IAddressProvider private _a;
  IDebtNotifier private _debtNotifier;
  IWETH private _weth;
  IERC20 private _mimo;
  IInceptionVaultsCore private _inceptionCore;

  uint8 private _collateralCount;
  mapping(uint8 => address) private _collaterals;
  mapping(address => uint8) private _collateralId;

  modifier onlyInceptionVaultsCore() {
    require(address(_inceptionCore) == msg.sender, "IV011");
    _;
  }

  function initialize(
    address _owner,
    IAddressProvider addressProvider,
    IDebtNotifier debtNotifier,
    IWETH weth,
    IERC20 mimo,
    IInceptionVaultsCore inceptionVaultsCore
  ) external override initializer {
    _a = addressProvider;
    _debtNotifier = debtNotifier;
    _weth = weth;
    _mimo = mimo;
    _inceptionCore = inceptionVaultsCore;
    owner = _owner;
  }

  /**
    Wraps ETH and deposits WETH into the vault of the msg.sender as collateral
    @dev A new vault is created if no WETH vault exists
  **/
  function depositETH() external payable override onlyOwner {
    _a.core().depositETH{ value: msg.value }();
  }

  /**
    Wraps ETH and deposits WETH into the vault of the msg.sender as collateral and borrows the specified amount of tokens in WEI
    @dev see depositETH() and borrow()
    @param _borrowAmount the amount of borrowed StableX tokens in WEI.
  **/
  function depositETHAndBorrow(uint256 _borrowAmount) external payable override onlyOwner {
    _a.core().depositETHAndBorrow{ value: msg.value }(_borrowAmount);
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
  ) external override onlyOwner {
    IERC20 asset = IERC20(_collateralType);
    asset.safeTransferFrom(msg.sender, address(this), _depositAmount);
    asset.safeIncreaseAllowance(address(_a.core()), _depositAmount);
    _a.core().depositAndBorrow(_collateralType, _depositAmount, _borrowAmount);
    if (_collateralId[_collateralType] == 0) {
      uint8 newId = ++_collateralCount;
      _collateralId[_collateralType] = newId;
      _collaterals[newId] = _collateralType;
    }
  }

  /**
    Withdraws ERC20 tokens from a vault.
    @dev Only the owner of a vault can withdraw collateral from it.
    `withdraw()` will fail if it would bring the vault below the minimum collateralization treshold.
    @param _vaultId the ID of the vault from which to withdraw the collateral.
    @param _amount the amount of ERC20 tokens to be withdrawn in WEI.
  **/
  function withdraw(uint256 _vaultId, uint256 _amount) external override onlyOwner {
    _a.core().withdraw(_vaultId, _amount);
    IERC20 asset = IERC20(_a.vaultsData().vaultCollateralType(_vaultId));
    asset.safeTransfer(msg.sender, _amount);
  }

  /**
    Releases the outstanding MIMO balance.
  */
  function claimMimo() external override {
    for (uint8 i = 1; i < _collateralCount + 1; i++) {
      IGenericMiner supplyMiner = IGenericMiner(address(_debtNotifier.collateralSupplyMinerMapping(_collaterals[i])));
      if (supplyMiner.pendingMIMO(address(this)) != 0) {
        supplyMiner.releaseMIMO(address(this));
      }
    }
  }

  /**
    Lends PAR to inceptionVault user. 
    @dev This function cn only be called by the InceptionVaultsCore.
    @param _amount the amount of PAR to be lended.
    @param _to the address of the inceptionVault user.
  */
  function lendPAR(uint256 _amount, address _to) external override onlyInceptionVaultsCore() {
    IERC20 stablex = IERC20(_a.stablex());
    stablex.safeTransfer(_to, _amount);
  }

  /**
    @dev See {IERC20-transfer}.
  */
  function transferMimo(uint256 _amount, address _to) external override onlyOwner {
    _mimo.safeTransfer(_to, _amount);
  }

  /**
    @dev See {IERC20-transfer}.
  */
  function transferPar(uint256 _amount, address _to) external override onlyOwner {
    IERC20 par = IERC20(address(_a.stablex()));
    par.safeTransfer(_to, _amount);
  }

  /**
    Deposit an ERC20 token into the vault of the msg.sender as collateral
    @dev A new vault is created if no vault exists for the `msg.sender` with the specified collateral type.
    this function uses `transferFrom()` and requires pre-approval via `approve()` on the ERC20.
    @param _collateralType the address of the collateral type to be deposited
    @param _amount the amount of tokens to be deposited in WEI.
  **/
  function deposit(address _collateralType, uint256 _amount) public override onlyOwner {
    IERC20 asset = IERC20(_collateralType);
    asset.safeTransferFrom(msg.sender, address(this), _amount);
    asset.safeIncreaseAllowance(address(_a.core()), _amount);
    _a.core().deposit(_collateralType, _amount);
  }

  /**
    Borrow new PAR tokens from a vault.
    @dev Only the owner of a vault can borrow from it.
    `borrow()` will update the outstanding vault debt to the current time before attempting the withdrawal.
     `borrow()` will fail if it would bring the vault below the minimum collateralization treshold.
    @param _vaultId the ID of the vault from which to borrow.
    @param _amount the amount of borrowed PAR tokens in WEI.
  **/
  function borrow(uint256 _vaultId, uint256 _amount) public override onlyOwner {
    _a.core().borrow(_vaultId, _amount);
    IVaultsDataProvider vaultsData = IVaultsDataProvider(_a.vaultsData());
    address vaultCollateral = vaultsData.vaultCollateralType(_vaultId);
    if (_collateralId[vaultCollateral] == 0) {
      uint8 newId = ++_collateralCount;
      _collateralId[vaultCollateral] = newId;
      _collaterals[newId] = vaultCollateral;
    }
  }

  function a() public view override returns (IAddressProvider) {
    return _a;
  }

  function debtNotifier() public view override returns (IDebtNotifier) {
    return _debtNotifier;
  }

  function weth() public view override returns (IWETH) {
    return _weth;
  }

  function mimo() public view override returns (IERC20) {
    return _mimo;
  }

  function inceptionCore() public view override returns (IInceptionVaultsCore) {
    return _inceptionCore;
  }

  function collateralCount() public view override returns (uint8) {
    return _collateralCount;
  }

  function collaterals(uint8 _id) public view override returns (address) {
    return _collaterals[_id];
  }

  function collateralId(address _collateral) public view override returns (uint8) {
    return _collateralId[_collateral];
  }
}
