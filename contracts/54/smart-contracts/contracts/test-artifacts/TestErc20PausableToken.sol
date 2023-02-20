pragma solidity 0.5.17;

import '@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Mintable.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Pausable.sol';


/**
 * This is an implementation of a ERC20 token with mint and pause capabilities
 * to be used in tests.
 *
 * This contract should not be used in production.
 */
contract TestErc20PausableToken is
  ERC20Mintable,
  ERC20Pausable
{
  constructor() public
  {
    ERC20Pausable.initialize(msg.sender);
    ERC20Mintable.initialize(msg.sender);
  }
}