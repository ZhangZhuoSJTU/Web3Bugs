pragma solidity >=0.6.6;

interface IDistributor {
  function vest() external;
  function totalDeclaredReward() external view returns (uint256);
  function decrementRewards(uint256 amount) external;
  function forfeit(uint256 amount) external;
  function declareReward(uint256 amount) external;
}
