pragma solidity >=0.6.6;

interface IImpliedCollateralService {
  function handleDeficit(uint256 maxAmount) external;
  function claim() external;
  function getCollateralValueInMalt() external view returns(uint256);
}
