pragma solidity 0.8.3;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

abstract contract IFloatToken is IERC20Upgradeable {
  function mint(address to, uint256 amount) public virtual;
}
