// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

interface IBooster {
    /**
     * @dev `_pid` is the ID of the Convex for a specific Curve LP token.
     */
    function deposit(
        uint256 _pid,
        uint256 _amount,
        bool _stake
    ) external returns (bool);

    function withdraw(uint256 _pid, uint256 _amount) external returns (bool);

    function withdrawAll(uint256 _pid) external returns (bool);

    function withdrawTo(
        uint256 _pid,
        uint256 _amount,
        address _to
    ) external returns (bool);

    function depositAll(uint256 _pid, bool _stake) external returns (bool);

    function poolInfo(uint256 pid)
        external
        view
        returns (
            address lpToken,
            address token,
            address gauge,
            address crvRewards,
            address stash,
            bool shutdown
        );
}
