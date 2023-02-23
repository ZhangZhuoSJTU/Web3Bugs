// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title   MassetHelpers
 * @author  mStable
 * @notice  Helper functions to facilitate minting and redemption from off chain
 * @dev     VERSION: 1.0
 *          DATE:    2020-03-28
 */
library MassetHelpers {
  using SafeERC20 for IERC20;

  function transferReturnBalance(
    address _sender,
    address _recipient,
    address _bAsset,
    uint256 _qty
  ) internal returns (uint256 receivedQty, uint256 recipientBalance) {
    uint256 balBefore = IERC20(_bAsset).balanceOf(_recipient);
    IERC20(_bAsset).safeTransferFrom(_sender, _recipient, _qty);
    recipientBalance = IERC20(_bAsset).balanceOf(_recipient);
    receivedQty = recipientBalance - balBefore;
  }

  function safeInfiniteApprove(address _asset, address _spender) internal {
    IERC20(_asset).safeApprove(_spender, 0);
    IERC20(_asset).safeApprove(_spender, 2**256 - 1);
  }
}
