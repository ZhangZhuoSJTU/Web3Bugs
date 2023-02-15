// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IAddressProvider.sol";
import "../interfaces/IVaultsDataProvider.sol";
import "../interfaces/IVaultsCore.sol";

contract RepayVault {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 public constant REPAY_PER_VAULT = 10 ether;

  IAddressProvider public a;

  constructor(IAddressProvider _addresses) public {
    require(address(_addresses) != address(0));

    a = _addresses;
  }

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender), "Caller is not Manager");
    _;
  }

  function repay() public onlyManager {
    IVaultsCore core = a.core();
    IVaultsDataProvider vaultsData = a.vaultsData();
    uint256 vaultCount = a.vaultsData().vaultCount();

    for (uint256 vaultId = 1; vaultId <= vaultCount; vaultId++) {
      uint256 baseDebt = vaultsData.vaultBaseDebt(vaultId);

      //if (vaultId==28 || vaultId==29 || vaultId==30 || vaultId==31 || vaultId==32 || vaultId==33 || vaultId==35){
      //  continue;
      //}

      if (baseDebt == 0) {
        continue;
      }

      core.repay(vaultId, REPAY_PER_VAULT);
    }

    IERC20 par = IERC20(a.stablex());
    par.safeTransfer(msg.sender, par.balanceOf(address(this)));
  }
}
