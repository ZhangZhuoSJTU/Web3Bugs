// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.8.10;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract SuperVaultFactory {
  using Address for address;
  using Clones for address;

  event NewSuperVaultContract(address indexed owner, address superVaultContract);

  address public base;

  constructor(address _base) public {
    require(address(_base) != address(0));

    base = _base;
  }

  function clone(bytes calldata _initdata) public {
    address superVaultContract = base.clone();
    superVaultContract.functionCall(_initdata);
  
    emit NewSuperVaultContract(msg.sender, superVaultContract);
  }
}
