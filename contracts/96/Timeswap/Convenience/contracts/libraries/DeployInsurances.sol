// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from '../interfaces/IConvenience.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {InsuranceInterest} from '../InsuranceInterest.sol';
import {InsurancePrincipal} from '../InsurancePrincipal.sol';

library DeployInsurances {
    function deployInsurances(
        IConvenience.Native storage native,
        bytes32 salt,
        IConvenience convenience,
        IPair pair,
        uint256 maturity
    ) external {
        
        native.insuranceInterest = new InsuranceInterest{salt: salt}(convenience, pair, maturity);
        native.insurancePrincipal = new InsurancePrincipal{salt: salt}(convenience, pair, maturity);
    }
}
