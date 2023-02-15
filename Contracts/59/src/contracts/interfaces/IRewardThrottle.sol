pragma solidity >=0.6.6;

interface IRewardThrottle {
  function handleReward() external;
  function epochAPR(uint256 epoch) external view returns (uint256);
  function targetAPR() external view returns (uint256);
  function epochData(uint256 epoch) external view returns (
    uint256 profit,
    uint256 rewarded,
    uint256 bondedValue,
    uint256 throttle
  );
  function checkRewardUnderflow() external;
}
