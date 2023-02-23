// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IDisperse {
  function disperseTokenSimple(
    IERC20 token,
    address[] memory recipients,
    uint256[] memory values
  ) external;
}
