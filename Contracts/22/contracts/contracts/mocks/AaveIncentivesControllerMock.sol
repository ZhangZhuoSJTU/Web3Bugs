// SPDX-License-Identifier: agpl-3.0

pragma solidity 0.8.3;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "../interfaces/aave/IAaveIncentivesController.sol";

contract AaveIncentivesControllerMock is IAaveIncentivesController {
  function claimRewards(
    address[] calldata assets,
    uint256 amount,
    address to
  ) external override returns (uint256 amountToClaim) {}

  function getUserUnclaimedRewards(address user) external view override returns (uint256 usersUnclaimedRewards) {}
}
