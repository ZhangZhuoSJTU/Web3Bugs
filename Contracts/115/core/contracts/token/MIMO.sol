// solium-disable security/no-block-members
// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../governance/interfaces/IGovernanceAddressProvider.sol";

/**
 * @title  MIMO
 * @notice  MIMO Governance token
 */
contract MIMO is ERC20("MIMO Parallel Governance Token", "MIMO") {
  IGovernanceAddressProvider public a;

  bytes32 public constant MIMO_MINTER_ROLE = keccak256("MIMO_MINTER_ROLE");

  constructor(IGovernanceAddressProvider _a) public {
    require(address(_a) != address(0));

    a = _a;
  }

  modifier onlyMIMOMinter() {
    require(a.controller().hasRole(MIMO_MINTER_ROLE, msg.sender), "Caller is not MIMO Minter");
    _;
  }

  function mint(address account, uint256 amount) public onlyMIMOMinter {
    _mint(account, amount);
  }

  function burn(address account, uint256 amount) public onlyMIMOMinter {
    _burn(account, amount);
  }
}
