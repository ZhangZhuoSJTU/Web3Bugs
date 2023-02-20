pragma solidity >=0.6.6;

interface IMovingAverage {
  function getValue() external view returns (uint256);
  function getValueWithLookback(uint256 _lookbackTime) external view returns (uint256);
  function update(uint256 newValue) external;
  function updateCumulative(uint256 _cumulative) external;
}
