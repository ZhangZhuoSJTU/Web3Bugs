pragma solidity >=0.6.6;

interface IMaltDataLab {
  function priceTarget() external view returns (uint256);
  function smoothedReserveRatio() external view returns (uint256);
  function smoothedMaltPrice() external view returns (uint256);
  function smoothedMaltInPool() external view returns (uint256);
  function reserveRatioAverage(uint256 _lookback) external view returns (uint256);
  function maltPriceAverage(uint256 _lookback) external view returns (uint256);
  function maltInPoolAverage(uint256 _lookback) external view returns (uint256);
  function realValueOfLPToken(uint256 amount) external view returns (uint256);
  function trackReserveRatio() external;
  function trackPool() external;
}
