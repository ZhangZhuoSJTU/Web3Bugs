// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from '../interfaces/IConvenience.sol';
import {IFactory} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IFactory.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {Deploy} from './Deploy.sol';
import {IDeployNatives} from '../interfaces/IDeployNatives.sol';

library DeployNative {
    using Deploy for IConvenience.Native;

    function deploy(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IDeployNatives.DeployNatives memory params
    ) internal {
        require(params.deadline >= block.timestamp, 'E504');

        IPair pair = factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');

        IConvenience.Native storage native = natives[params.asset][params.collateral][params.maturity];
        require(address(native.liquidity) == address(0), 'E503');

        native.deploy(convenience, pair, params.asset, params.collateral, params.maturity);
    }
}
