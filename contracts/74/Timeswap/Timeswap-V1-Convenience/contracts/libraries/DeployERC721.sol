// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from '../interfaces/IConvenience.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {CollateralizedDebt} from '../CollateralizedDebt.sol';

library DeployERC721 {
    function deployERC721(
        IConvenience.Native storage native,
        bytes32 salt,
        IConvenience convenience,
        IPair pair,
        uint256 maturity
    ) external {
        native.collateralizedDebt = new CollateralizedDebt{salt: salt}(convenience, pair, maturity);
    }
}
