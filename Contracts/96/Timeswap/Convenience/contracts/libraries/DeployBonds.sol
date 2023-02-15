// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from '../interfaces/IConvenience.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {BondInterest} from '../BondInterest.sol';
import {BondPrincipal} from '../BondPrincipal.sol';

library DeployBonds {
    function deployBonds(
        IConvenience.Native storage native,
        bytes32 salt,
        IConvenience convenience,
        IPair pair,
        uint256 maturity
    ) external {
        native.bondInterest = new BondInterest{salt: salt}(convenience, pair, maturity);
        native.bondPrincipal = new BondPrincipal{salt: salt}(convenience, pair, maturity);
    }
}
