// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '../interfaces/IPooledCreditLineDeclarations.sol';

interface IPooledCreditLine is IPooledCreditLineDeclarations {
    function accept(
        uint256 _id,
        uint256 _amount,
        address _by
    ) external;

    function liquidate(uint256 _id) external returns (address, uint256);

    function getPrincipal(uint256 _id) external view returns (uint256);

    function getBorrowerAddress(uint256 _id) external view returns (address);

    function getEndsAt(uint256 _id) external view returns (uint256);

    function cancelRequestOnLowCollection(uint256 _id) external;

    function cancelRequestOnRequestedStateAtEnd(uint256 _id) external;

    function getStatusAndUpdate(uint256 _id) external returns (PooledCreditLineStatus);
}
