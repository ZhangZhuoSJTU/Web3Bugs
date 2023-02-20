// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

/**
@title SyntheticToken
@notice An ERC20 token that tracks or inversely tracks the price of an
        underlying asset with floating exposure.
*/
abstract contract ISyntheticToken is ERC20PresetMinterPauser {
  /// @notice Allows users to stake their synthetic tokens to earn Float.
  function stake(uint256 amount) external virtual;
}
