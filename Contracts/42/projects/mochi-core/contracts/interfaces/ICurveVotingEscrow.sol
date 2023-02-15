// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

interface ICurveVotingEscrow {
    function create_lock(uint256, uint256) external;

    function increase_amount(uint256) external;

    function increase_unlock_time(uint256) external;

    function withdraw() external;

    function smart_wallet_checker() external view returns (address);
}
