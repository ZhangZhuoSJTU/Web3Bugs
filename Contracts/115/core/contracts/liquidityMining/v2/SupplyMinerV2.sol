// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./GenericMinerV2.sol";
import "./interfaces/ISupplyMinerV2.sol";
import "../../governance/interfaces/IGovernanceAddressProvider.sol";

contract SupplyMinerV2 is ISupplyMinerV2, GenericMinerV2 {
  IERC20 private immutable _collateral;

  constructor(
    IGovernanceAddressProvider _addresses,
    BoostConfig memory _boostConfig,
    IERC20 collateral
  ) public GenericMinerV2(_addresses, _boostConfig) {
    require(address(collateral) != address(0), "LM000");
    _collateral = collateral;
  }

  modifier onlyNotifier() {
    require(msg.sender == address(_a.debtNotifier()), "LM020");
    _;
  }

  /**
    Updates user stake based on current user baseDebt
    @dev this method is for upgradability purposes from an older SupplyMiner to a newer one so the user doesn't have to repay/borrow to set their stake in this SupplyMiner
    @param user address of the user
  */
  function syncStake(address user) external override {
    uint256 vaultId = _a.parallel().vaultsData().vaultId(address(_collateral), user);
    IVaultsDataProvider.Vault memory v = _a.parallel().vaultsData().vaults(vaultId);
    _updateStake(user, v.baseDebt);
  }

  /**
    Gets called by the `DebtNotifier` and will update the stake of the user
    to match his current outstanding debt by using his baseDebt
    @param user address of the user
    @param newBaseDebt the new baseDebt and therefore stake for the user
  */
  function baseDebtChanged(address user, uint256 newBaseDebt) public override onlyNotifier {
    _updateStake(user, newBaseDebt);
  }

  function collateral() public view override returns (IERC20) {
    return _collateral;
  }
}
