pragma solidity >=0.6.6;

interface ILiquidityExtension {
  function hasMinimumReserves() external view returns (bool);
  function collateralDeficit() external view returns (uint256, uint256);
  function reserveRatio() external view returns (uint256, uint256);
  function purchaseAndBurn(uint256 amount) external returns (uint256 purchased);
  function buyBack(uint256 maltAmount) external;
}
