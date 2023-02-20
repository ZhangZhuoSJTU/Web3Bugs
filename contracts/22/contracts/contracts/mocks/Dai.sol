// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

// This is needed for truffle migrations, not used in tests.
contract Dai is ERC20PresetMinterPauser {
  constructor(string memory name, string memory symbol) ERC20PresetMinterPauser(name, symbol) {}
}
