// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {ERC205} from "../../shared/@openzeppelin-2.5/ERC205.sol";
import {InitializableERC20Detailed} from "../../shared/InitializableERC20Detailed.sol";

/**
 * @title  InitializableToken
 * @author mStable
 * @dev    Basic ERC20Detailed Token functionality for Masset
 */
contract MockInitializableToken is ERC205, InitializableERC20Detailed {
  /**
   * @dev Initialization function for implementing contract
   * @notice To avoid variable shadowing appended `Arg` after arguments name.
   */
  function initialize(
    string calldata _nameArg,
    string calldata _symbolArg,
    uint8 _decimals,
    address _initialRecipient,
    uint256 _initialMint
  ) external {
    InitializableERC20Detailed._initialize(_nameArg, _symbolArg, _decimals);

    _mint(_initialRecipient, _initialMint * (10**uint256(_decimals)));
  }
}
