//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

/**
 * @title Comptroller Interface
 * @dev Work with UnionToken and UserManager to calculate the Union rewards based on the staking info from UserManager, and be ready to support multiple UserManagers for various tokens when we support multiple assets.
 */
interface IComptroller {
    /**
     *  @dev Get the reward multipier based on the account status
     *  @param account Account address
     *  @return Multiplier number (in wei)
     */
    function getRewardsMultiplier(address account, address token) external view returns (uint256);

    /**
     *  @dev Withdraw rewards
     *  @return Amount of rewards
     */
    function withdrawRewards(address sender, address token) external returns (uint256);

    function addFrozenCoinAge(
        address staker,
        address token,
        uint256 lockedStake,
        uint256 lastRepay
    ) external;

    function updateTotalStaked(address token, uint256 totalStaked) external returns (bool);

    /**
     *  @dev Calculate unclaimed rewards based on blocks
     *  @param account User address
     *  @param futureBlocks Number of blocks in the future
     *  @return Unclaimed rewards
     */
    function calculateRewardsByBlocks(
        address account,
        address token,
        uint256 futureBlocks
    ) external view returns (uint256);

    /**
     *  @dev Calculate currently unclaimed rewards
     *  @param account Account address
     *  @return Unclaimed rewards
     */
    function calculateRewards(address account, address token) external view returns (uint256);
}
