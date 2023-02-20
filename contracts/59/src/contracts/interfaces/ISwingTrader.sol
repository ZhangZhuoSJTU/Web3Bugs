pragma solidity >=0.6.6;

interface ISwingTrader {
  function buyMalt(uint256 maxCapital) external returns (uint256 capitalUsed);
  function sellMalt(uint256 maxAmount) external returns (uint256 amountSold);
  function costBasis() external view returns (uint256 cost, uint256 decimals);
}
