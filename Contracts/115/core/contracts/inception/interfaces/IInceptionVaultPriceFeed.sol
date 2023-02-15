// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../chainlink/AggregatorV3Interface.sol";
import "../../interfaces/IAddressProvider.sol";

interface IInceptionVaultPriceFeed {
  event PriceFeedAdded(uint16 _id, address _priceFeed);

  function initialize(
    IAddressProvider _addresses,
    address _inceptionCollateral,
    address _assetOracle,
    AggregatorV3Interface _eurOracle
  ) external;

  function a() external view returns (IAddressProvider);

  function inceptionCollateral() external view returns (ERC20);

  function assetOracle() external view returns (AggregatorV3Interface);

  function eurOracle() external view returns (AggregatorV3Interface);

  function getAssetPrice() external view returns (uint256);

  function convertFrom(uint256 _amount) external view returns (uint256);

  function convertTo(uint256 _amount) external view returns (uint256);
}
