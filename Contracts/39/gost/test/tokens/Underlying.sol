// SPDX-License-Identifier: UNLICENSED

/**
  Underlying is a (for now) ERC20 compatible token interface
*/

pragma solidity 0.8.4;

// For v2 we only need to read the balance and allowance of underlying
contract Underlying {
  mapping (address => uint256) public balances;

  mapping (address => mapping (address => uint256)) public allowances;

  function balanceOf(address o) public view returns (uint256) {
    return balances[o]; // this should not matter to the abi. i think...
  }

  function allowance(address o, address s) public view returns (uint256) {
    return allowances[o][s];
  }
}
