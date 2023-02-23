// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IVotiumBribe {
  function depositBribe(
    address _token,
    uint256 _amount,
    bytes32 _proposal,
    uint256 _choiceIndex
  ) external;
}
