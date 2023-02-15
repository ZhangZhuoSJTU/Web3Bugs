//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "./interfaces/IInceptionVaultsCore.sol";
import "./interfaces/IInceptionVaultsDataProvider.sol";
import "../interfaces/IAddressProvider.sol";

contract InceptionVaultsDataProvider is IInceptionVaultsDataProvider, Initializable {
  using SafeMath for uint256;

  IAddressProvider private _a;
  IInceptionVaultsCore private _inceptionVaultsCore;

  uint256 private _inceptionVaultCount;

  uint256 private _baseDebt;

  mapping(uint256 => InceptionVault) private _vaults;
  mapping(address => uint256) private _vaultOwners;

  modifier onlyInceptionCore() {
    require(msg.sender == address(_inceptionVaultsCore), "IV011");
    _;
  }

  function initialize(IInceptionVaultsCore inceptionVaultsCore, IAddressProvider addressProvider)
    external
    override
    initializer
  {
    _inceptionVaultsCore = inceptionVaultsCore;
    _a = addressProvider;
  }

  /**
    Opens a new vault.
    @dev only the vaultsCore module can call this function
    @param _owner the owner of the new vault.
  */
  function createVault(address _owner) external override onlyInceptionCore returns (uint256) {
    uint256 newId = ++_inceptionVaultCount;
    InceptionVault memory v = InceptionVault({
      owner: _owner,
      collateralBalance: 0,
      baseDebt: 0,
      createdAt: block.timestamp
    });
    _vaults[newId] = v;
    _vaultOwners[_owner] = newId;
    return newId;
  }

  /**
    Set the collateral balance of a vault.
    @dev only the vaultsCore module can call this function
    @param _vaultId Vault ID of which the collateral balance will be updated
    @param _balance the new balance of the vault.
  */
  function setCollateralBalance(uint256 _vaultId, uint256 _balance) external override onlyInceptionCore {
    require(vaultExists(_vaultId), "IV105");
    InceptionVault storage v = _vaults[_vaultId];
    v.collateralBalance = _balance;
  }

  /**
   Set the base debt of a vault.
    @dev only the vaultsCore module can call this function
    @param _id Vault ID of which the base debt will be updated
    @param _newBaseDebt the new base debt of the vault.
  */
  function setBaseDebt(uint256 _id, uint256 _newBaseDebt) external override onlyInceptionCore {
    InceptionVault storage _vault = _vaults[_id];
    if (_newBaseDebt > _vault.baseDebt) {
      uint256 increase = _newBaseDebt.sub(_vault.baseDebt);
      _baseDebt = _baseDebt.add(increase);
    } else {
      uint256 decrease = _vault.baseDebt.sub(_newBaseDebt);
      _baseDebt = _baseDebt.sub(decrease);
    }
    _vault.baseDebt = _newBaseDebt;
  }

  /**
    Get a vault by vault ID.
    @param _id The vault's ID to be retrieved
    @return struct InceptionVault {
      address owner;
      uint256 collateralBalance;
      uint256 baseDebt;
      uint256 createdAt;
    }
  */
  function vaults(uint256 _id) external view override returns (InceptionVault memory) {
    InceptionVault memory v = _vaults[_id];
    return v;
  }

  /**
    Get the owner of a vault.
    @param _id the ID of the vault
    @return owner of the vault
  */
  function vaultOwner(uint256 _id) external view override returns (address) {
    return _vaults[_id].owner;
  }

  /**
   Get the collateral balance of a vault.
@param _id the ID of the vault
    @return collateral balance of the vault
  */
  function vaultCollateralBalance(uint256 _id) external view override returns (uint256) {
    return _vaults[_id].collateralBalance;
  }

  /**
   Get the base debt of a vault.
@param _id the ID of the vault
    @return base debt of the vault
  */
  function vaultBaseDebt(uint256 _id) external view override returns (uint256) {
    return _vaults[_id].baseDebt;
  }

  /**
    Retrieve the vault id for a specified owner and collateral type.
    @dev returns 0 for non-existing vaults
    @param _owner address of the owner of the vault
    @return vault id of the vault or 0
  */
  function vaultId(address _owner) external view override returns (uint256) {
    return _vaultOwners[_owner];
  }

  /**
    Calculated the total outstanding debt for a specific vault.
    @dev uses the existing cumulative rate. Call `refreshCollateral()` on `VaultsCore`
    to make sure it's up to date.
    @param _vaultId the ID of the vault
    @return total debt of one vault
  */
  function vaultDebt(uint256 _vaultId) external view override returns (uint256) {
    InceptionVault memory v = _vaults[_vaultId];
    return _a.ratesManager().calculateDebt(v.baseDebt, _inceptionVaultsCore.cumulativeRate());
  }

  /**
    Checks if a specified vault exists.
    @param _id the ID of the vault
    @return boolean if the vault exists
  */
  function vaultExists(uint256 _id) public view override returns (bool) {
    InceptionVault memory v = _vaults[_id];
    return v.owner != address(0);
  }

  function a() public view override returns (IAddressProvider) {
    return _a;
  }

  function inceptionVaultsCore() public view override returns (IInceptionVaultsCore) {
    return _inceptionVaultsCore;
  }

  function inceptionVaultCount() public view override returns (uint256) {
    return _inceptionVaultCount;
  }

  function baseDebt() public view override returns (uint256) {
    return _baseDebt;
  }
}
