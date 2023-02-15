// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract OverlayToken is AccessControlEnumerable, ERC20("Overlay", "OVL") {

  bytes32 public constant ADMIN_ROLE = 0x00;
  bytes32 public constant MINTER_ROLE = keccak256("MINTER");
  bytes32 public constant BURNER_ROLE = keccak256("BURNER");

  constructor() {

    _setupRole(ADMIN_ROLE, msg.sender);
    _setupRole(MINTER_ROLE, msg.sender);
    _setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);
    _setRoleAdmin(BURNER_ROLE, ADMIN_ROLE);

  }

  modifier onlyMinter() {
    require(hasRole(MINTER_ROLE, msg.sender), "only minter");
    _;
  }

  modifier onlyBurner() {
    require(hasRole(BURNER_ROLE, msg.sender), "only burner");
    _;
  }

  function mint(address _recipient, uint256 _amount) external onlyMinter {
      _mint(_recipient, _amount);
  }

  function burn(address _account, uint256 _amount) external onlyBurner {
      _burn(_account, _amount);
  }
}
