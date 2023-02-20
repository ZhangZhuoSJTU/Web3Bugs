// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

library SafeTransfer {
    using SafeERC20 for IERC20;

    function safeTransfer(
        IERC20 token,
        IPair to,
        uint256 amount
    ) internal {
        token.safeTransfer(address(to), amount);
    }

    function safeTransferFrom(
        IERC20 token,
        address from,
        IPair to,
        uint256 amount
    ) internal {
        token.safeTransferFrom(from, address(to), amount);
    }
}
