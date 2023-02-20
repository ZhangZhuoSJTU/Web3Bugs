pragma solidity >=0.6.6;

interface IRewardMine {
  function rewardToken() external view returns (address);
  function onBond(address account, uint256 amount) external;
  function onUnbond(address account, uint256 amount) external;
  function withdrawAll() external;
  function withdraw(uint256 rewardAmount) external;
  function totalBonded() external view returns (uint256);
  function balanceOfBonded(address account) external view returns (uint256);
  function totalDeclaredReward() external view returns (uint256);
  function totalReleasedReward() external view returns (uint256);
  function totalStakePadding() external view returns(uint256);
  function balanceOfStakePadding(address account) external view returns (uint256);
  function getRewardOwnershipFraction(address account) external view returns(uint256 numerator, uint256 denominator);
  function balanceOfRewards(address account) external view returns (uint256);
  function earned(address account) external view returns (uint256 earnedReward);
  function withdrawForAccount(address account, uint256 amount, address to) external returns (uint256);
}
