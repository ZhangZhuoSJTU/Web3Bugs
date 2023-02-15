// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeTransfer} from '../libraries/SafeTransfer.sol';

contract SafeTransferCallee{
    function safeTransfer(IERC20 token, IPair to, uint256 amount) public  {
        return SafeTransfer.safeTransfer(token, to, amount);
    }
    function safeTransferFrom( IERC20 token,
        address from,
        IPair to,
        uint256 amount) public{
            return SafeTransfer.safeTransferFrom(token, from, to, amount);
        }
}