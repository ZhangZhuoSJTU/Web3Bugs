// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IVaultsDataProvider.sol";
import "../interfaces/IAddressProvider.sol";

contract VaultsDataProvider is IVaultsDataProvider {
  using SafeMath for uint256;

  IAddressProvider public override a;

  uint256 public override vaultCount = 0;

  mapping(address => uint256) public override baseDebt;

  mapping(uint256 => Vault) private _vaults;
  mapping(address => mapping(address => uint256)) private _vaultOwners;

  modifier onlyVaultsCore() {
    require(msg.sender == address(a.core()), "Caller is not VaultsCore");
    _;
  }

  constructor(IAddressProvider _addresses) public {
    require(address(_addresses) != address(0));
    a = _addresses;
  }

  /**
    Opens a new vault.
    @dev only the vaultsCore module can call this function
    @param _collateralType address to the collateral asset e.g. WETH
    @param _owner the owner of the new vault.
  */
  function createVault(address _collateralType, address _owner) public override onlyVaultsCore returns (uint256) {
    require(_collateralType != address(0));
    require(_owner != address(0));
    uint256 newId = ++vaultCount;
    require(_collateralType != address(0), "collateralType unknown");
    Vault memory v = Vault({
      collateralType: _collateralType,
      owner: _owner,
      collateralBalance: 0,
      baseDebt: 0,
      createdAt: block.timestamp
    });
    _vaults[newId] = v;
    _vaultOwners[_owner][_collateralType] = newId;
    return newId;
  }

  /**
    Set the collateral balance of a vault.
    @dev only the vaultsCore module can call this function
    @param _id Vault ID of which the collateral balance will be updated
    @param _balance the new balance of the vault.
  */
  function setCollateralBalance(uint256 _id, uint256 _balance) public override onlyVaultsCore {
    require(vaultExists(_id), "Vault not found.");
    Vault storage v = _vaults[_id];
    v.collateralBalance = _balance;
  }

  /**
    Set the base debt of a vault.
    @dev only the vaultsCore module can call this function
    @param _id Vault ID of which the base debt will be updated
    @param _newBaseDebt the new base debt of the vault.
  */
  function setBaseDebt(uint256 _id, uint256 _newBaseDebt) public override onlyVaultsCore {
    Vault storage _vault = _vaults[_id];
    if (_newBaseDebt > _vault.baseDebt) {
      uint256 increase = _newBaseDebt.sub(_vault.baseDebt);
      baseDebt[_vault.collateralType] = baseDebt[_vault.collateralType].add(increase);
    } else {
      uint256 decrease = _vault.baseDebt.sub(_newBaseDebt);
      baseDebt[_vault.collateralType] = baseDebt[_vault.collateralType].sub(decrease);
    }
    _vault.baseDebt = _newBaseDebt;
  }

  /**
    Get a vault by vault ID.
    @param _id The vault's ID to be retrieved
    @return struct Vault {
      address collateralType;
      address owner;
      uint256 collateralBalance;
      uint256 baseDebt;
      uint256 createdAt;
    }
  */
  function vaults(uint256 _id) public view override returns (Vault memory) {
    Vault memory v = _vaults[_id];
    return v;
  }

  /**
    Get the owner of a vault.
    @param _id the ID of the vault
    @return owner of the vault
  */
  function vaultOwner(uint256 _id) public view override returns (address) {
    return _vaults[_id].owner;
  }

  /**
    Get the collateral type of a vault.
    @param _id the ID of the vault
    @return address for the collateral type of the vault
  */
  function vaultCollateralType(uint256 _id) public view override returns (address) {
    return _vaults[_id].collateralType;
  }

  /**
    Get the collateral balance of a vault.
    @param _id the ID of the vault
    @return collateral balance of the vault
  */
  function vaultCollateralBalance(uint256 _id) public view override returns (uint256) {
    return _vaults[_id].collateralBalance;
  }

  /**
    Get the base debt of a vault.
    @param _id the ID of the vault
    @return base debt of the vault
  */
  function vaultBaseDebt(uint256 _id) public view override returns (uint256) {
    return _vaults[_id].baseDebt;
  }

  /**
    Retrieve the vault id for a specified owner and collateral type.
    @dev returns 0 for non-existing vaults
    @param _collateralType address of the collateral type (Eg: WETH)
    @param _owner address of the owner of the vault
    @return vault id of the vault or 0
  */
  function vaultId(address _collateralType, address _owner) public view override returns (uint256) {
    return _vaultOwners[_owner][_collateralType];
  }

  /**
    Checks if a specified vault exists.
    @param _id the ID of the vault
    @return boolean if the vault exists
  */
  function vaultExists(uint256 _id) public view override returns (bool) {
    Vault memory v = _vaults[_id];
    return v.collateralType != address(0);
  }

  /**
    Calculated the total outstanding debt for all vaults and all collateral types.
    @dev uses the existing cumulative rate. Call `refresh()` on `VaultsCore`
    to make sure it's up to date.
    @return total debt of the platform
  */
  function debt() public view override returns (uint256) {
    uint256 total = 0;
    for (uint256 i = 1; i <= a.config().numCollateralConfigs(); i++) {
      address collateralType = a.config().collateralConfigs(i).collateralType;
      total = total.add(collateralDebt(collateralType));
    }
    return total;
  }

  /**
    Calculated the total outstanding debt for all vaults of a specific collateral type.
    @dev uses the existing cumulative rate. Call `refreshCollateral()` on `VaultsCore`
    to make sure it's up to date.
    @param _collateralType address of the collateral type (Eg: WETH)
    @return total debt of the platform of one collateral type
  */
  function collateralDebt(address _collateralType) public view override returns (uint256) {
    return a.ratesManager().calculateDebt(baseDebt[_collateralType], a.core().cumulativeRates(_collateralType));
  }

  /**
    Calculated the total outstanding debt for a specific vault.
    @dev uses the existing cumulative rate. Call `refreshCollateral()` on `VaultsCore`
    to make sure it's up to date.
    @param _vaultId the ID of the vault
    @return total debt of one vault
  */
  function vaultDebt(uint256 _vaultId) public view override returns (uint256) {
    IVaultsDataProvider.Vault memory v = _vaults[_vaultId];
    return a.ratesManager().calculateDebt(v.baseDebt, a.core().cumulativeRates(v.collateralType));
  }
}
