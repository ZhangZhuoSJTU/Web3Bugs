// solium-disable security/no-block-members
// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IAddressProvider.sol";
import "../interfaces/ISTABLEX.sol";

/**
 * @title   USDX
 * @notice  Stablecoin which can be minted against collateral in a vault
 */
contract USDX is ISTABLEX, ERC20("USD Stablecoin", "USDX") {
  IAddressProvider public override a;

  constructor(IAddressProvider _addresses) public {
    require(address(_addresses) != address(0));
    a = _addresses;
  }

  function mint(address account, uint256 amount) public override onlyMinter {
    _mint(account, amount);
  }

  function burn(address account, uint256 amount) public override onlyMinter {
    _burn(account, amount);
  }

  modifier onlyMinter() {
    require(a.controller().hasRole(a.controller().MINTER_ROLE(), msg.sender), "Caller is not a minter");
    _;
  }
}
