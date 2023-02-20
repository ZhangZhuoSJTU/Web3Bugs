// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IAxelarGateway } from './IAxelarGateway.sol';

interface IAxelarGatewaySinglesig is IAxelarGateway {
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    event OperatorshipTransferred(address indexed previousOperator, address indexed newOperator);

    function owner() external view returns (address);

    function operator() external view returns (address);
}
