// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

interface IGauge {
    function deposit(uint256) external;

    function balanceOf(address) external view returns (uint256);

    function withdraw(uint256) external;

    function user_checkpoint(address) external;

    function claimable_tokens(address) external view returns (uint256);
}

interface IVotingEscrow {
    function create_lock(uint256 _value, uint256 _time) external;

    function increase_amount(uint256 _value) external;

    function increase_unlock_time(uint256 _unlock_time) external;

    function withdraw() external;

    function balanceOf(address _address) external view returns (uint256);

    function totalSupply() external view returns (uint256);
}

interface IFeeDistributor {
    function claim(address _addr) external returns (uint256);
}
