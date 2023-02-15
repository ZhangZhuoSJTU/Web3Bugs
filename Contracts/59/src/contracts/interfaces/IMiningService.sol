pragma solidity >=0.6.6;

interface IMiningService {
  function withdrawAccountRewards(uint256 amount) external;
  function balanceOfRewards(address account) external view returns (uint256);
  function earned(address account) external view returns (uint256);
  function onBond(address account, uint256 amount) external;
  function onUnbond(address account, uint256 amount) external;
  function withdrawRewardsForAccount(address account, uint256 amount) external;
}
