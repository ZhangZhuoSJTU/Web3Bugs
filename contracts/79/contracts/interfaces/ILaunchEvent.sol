// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ILaunchEvent {
    function initialize(
        address _issuer,
        uint256 _phaseOne,
        address _token,
        uint256 _tokenIncentivesPercent,
        uint256 _floorPrice,
        uint256 _maxWithdrawPenalty,
        uint256 _fixedWithdrawPenalty,
        uint256 _maxAllocation,
        uint256 _userTimelock,
        uint256 _issuerTimelock
    ) external;
}
