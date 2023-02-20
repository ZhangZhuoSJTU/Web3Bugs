pragma solidity >=0.6.6;

interface IOverflow {
  function requestCapital(uint256 amount) external returns (uint256 fulfilledAmount);
  function purchaseArbitrageTokens(uint256 maxAmount)
    external returns (uint256 remaining);
  function claim() external;
  function outstandingArbTokens() external view returns (uint256 outstanding);
}
