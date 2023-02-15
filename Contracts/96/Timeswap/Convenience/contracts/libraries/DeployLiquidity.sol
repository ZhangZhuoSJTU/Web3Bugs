// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from '../interfaces/IConvenience.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {Liquidity} from '../Liquidity.sol';

library DeployLiquidity {
    function deployLiquidity(
        IConvenience.Native storage native,
        bytes32 salt,
        IConvenience convenience,
        IPair pair,
        uint256 maturity
    ) external {
        native.liquidity = new Liquidity{salt: salt}(convenience, pair, maturity);
    }
}
