// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {SafeTransfer} from '../../libraries/SafeTransfer.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract SafeTransferTest {
    using SafeTransfer for IERC20;

    function safeTransfer(
        IERC20 token,
        address to,
        uint256 amount
    ) external {
        token.safeTransfer(address(to), amount);
    }
}
