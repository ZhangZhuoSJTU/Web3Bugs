// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IAxelarGateway } from './IAxelarGateway.sol';

interface IAxelarGatewayMultisig is IAxelarGateway {
    event OwnershipTransferred(address[] preOwners, uint256 prevThreshold, address[] newOwners, uint256 newThreshold);

    event OperatorshipTransferred(
        address[] preOperators,
        uint256 prevThreshold,
        address[] newOperators,
        uint256 newThreshold
    );

    function ownerEpoch() external view returns (uint256);

    function ownerThreshold(uint256 epoch) external view returns (uint256);

    function owners(uint256 epoch) external view returns (address[] memory);

    function operatorEpoch() external view returns (uint256);

    function operatorThreshold(uint256 epoch) external view returns (uint256);

    function operators(uint256 epoch) external view returns (address[] memory);
}
