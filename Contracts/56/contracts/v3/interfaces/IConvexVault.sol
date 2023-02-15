// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IConvexVault {
    function poolInfo(uint256 pid)
        external
        view
        returns (
            address lptoken,
            address token,
            address gauge,
            address crvRewards,
            address stash,
            bool shutdown
        );

    function deposit(
        uint256 pid,
        uint256 amount,
        bool stake
    ) external returns (bool);

    function depositAll(uint256 pid, bool stake) external returns (bool);

    function withdraw(uint256 pid, uint256 amount) external returns (bool);

    function withdrawAll(uint256 pid) external returns (bool);
}

interface IConvexRewards {
    function getReward(address _account, bool _claimExtras) external returns (bool);

    function extraRewardsLength() external view returns (uint256);

    function extraRewards(uint256 _pid) external view returns (address);

    function rewardToken() external view returns (address);
}
