// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

interface IEmergencyHandler {
    function emergencyWithdrawal(
        address user,
        bool pwrd,
        uint256 inAmount,
        uint256 minAmounts
    ) external;

    function emergencyWithdrawAll(
        address user,
        bool pwrd,
        uint256 minAmounts
    ) external;
}
