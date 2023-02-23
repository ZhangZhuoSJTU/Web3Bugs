// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {ERC205, IERC20} from "./@openzeppelin-2.5/ERC205.sol";
import {InitializableERC20Detailed} from "./InitializableERC20Detailed.sol";

/**
 * @title  InitializableToken
 * @author mStable
 * @dev    Basic ERC20Detailed Token functionality for Masset
 */
abstract contract InitializableToken is ERC205, InitializableERC20Detailed {
  /**
   * @dev Initialization function for implementing contract
   * @notice To avoid variable shadowing appended `Arg` after arguments name.
   */
  function _initialize(string memory _nameArg, string memory _symbolArg)
    internal
    virtual
  {
    InitializableERC20Detailed._initialize(_nameArg, _symbolArg, 18);
  }
}
