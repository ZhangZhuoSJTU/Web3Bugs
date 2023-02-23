// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {IVotes} from "../interfaces/IVotes.sol";
import {DialData} from "../emissions/EmissionsController.sol";

/**
 * @title IEmissionsController
 * @dev Emissions Controller interface used for by RevenueBuyBack
 */
interface IEmissionsController {
  function getDialRecipient(uint256 dialId)
    external
    returns (address recipient);

  function donate(uint256[] memory _dialIds, uint256[] memory _amounts)
    external;

  function stakingContracts(uint256 dialId) external returns (address);
}
