// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

import '@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Mintable.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol';


/**
* @title The Unlock Discount Token
* This smart contract implements the Unlock Discount Token
*/
contract UnlockDiscountToken is
ERC20Mintable,
ERC20Detailed
{
  /**
   * @notice A one-time call to configure the token.
   * @param _minter A wallet with permissions to mint tokens and/or add other minters.
   */
  function initialize(address _minter) public initializer()
  {
    ERC20Mintable.initialize(_minter);
    ERC20Detailed.initialize('Unlock Discount Token', 'UDT', 18);
  }
}
