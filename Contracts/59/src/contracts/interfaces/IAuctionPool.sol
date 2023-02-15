pragma solidity >=0.6.6;

interface IAuctionPool {
  function onUnbond(address account, uint256 amount) external;
  function totalBonded() external view returns (uint256);
  function balanceOfBonded(address account) external view returns (uint256);
  function totalDeclaredReward() external view returns (uint256);
  function totalReleasedReward() external view returns (uint256);

  function purchaseArbitrageTokens(uint256 maxAmount)
    external returns (uint256 remaining);
  function claim() external;
  function outstandingArbTokens() external view returns (uint256 outstanding);

  function onBond(address account, uint256 amount) external;
  function withdrawAll() external;
  function withdraw(uint256 rewardAmount) external;
  function totalStakePadding() external view returns(uint256);
  function balanceOfStakePadding(address account) external view returns (uint256);
  function getRewardOwnershipFraction(address account) external view returns(uint256 numerator, uint256 denominator);
  function balanceOfRewards(address account) external view returns (uint256);
  function earned(address account) external view returns (uint256 earnedReward);
  function withdrawForAccount(address account, uint256 amount, address to) external returns (uint256);
}
