// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/IPriceFeed.sol";
import "../interfaces/IAddressProvider.sol";
import "../chainlink/AggregatorV3Interface.sol";
import "../libraries/MathPow.sol";
import "../libraries/WadRayMath.sol";

contract PriceFeed is IPriceFeed {
  using SafeMath for uint256;
  using SafeMath for uint8;
  using WadRayMath for uint256;

  uint256 public constant PRICE_ORACLE_STALE_THRESHOLD = 1 days;

  IAddressProvider public override a;

  mapping(address => AggregatorV3Interface) public override assetOracles;

  AggregatorV3Interface public override eurOracle;

  constructor(IAddressProvider _addresses) public {
    require(address(_addresses) != address(0));
    a = _addresses;
  }

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender), "Caller is not a Manager");
    _;
  }

  /**
   * @notice Sets the oracle for the given asset,
   * @param _asset address to the collateral asset e.g. WETH
   * @param _oracle address to the oracel, this oracle should implement the AggregatorV3Interface
   */
  function setAssetOracle(address _asset, address _oracle) public override onlyManager {
    require(_asset != address(0));
    require(_oracle != address(0));
    assetOracles[_asset] = AggregatorV3Interface(_oracle);
    emit OracleUpdated(_asset, _oracle, msg.sender);
  }

  /**
   * @notice Sets the oracle for EUR, this oracle should provide EUR-USD prices
   * @param _oracle address to the oracle, this oracle should implement the AggregatorV3Interface
   */
  function setEurOracle(address _oracle) public override onlyManager {
    require(_oracle != address(0));
    eurOracle = AggregatorV3Interface(_oracle);
    emit EurOracleUpdated(_oracle, msg.sender);
  }

  /**
   * Gets the asset price in EUR (PAR)
   * @dev returned value has matching decimals to the asset oracle (not the EUR oracle)
   * @param _asset address to the collateral asset e.g. WETH
   */
  function getAssetPrice(address _asset) public view override returns (uint256 price) {
    (, int256 eurAnswer, , uint256 eurUpdatedAt, ) = eurOracle.latestRoundData();
    require(eurAnswer > 0, "EUR price data not valid");
    require(block.timestamp - eurUpdatedAt < PRICE_ORACLE_STALE_THRESHOLD, "EUR price data is stale");

    (, int256 answer, , uint256 assetUpdatedAt, ) = assetOracles[_asset].latestRoundData();
    require(answer > 0, "Price data not valid");
    require(block.timestamp - assetUpdatedAt < PRICE_ORACLE_STALE_THRESHOLD, "Price data is stale");

    uint8 eurDecimals = eurOracle.decimals();
    uint256 eurAccuracy = MathPow.pow(10, eurDecimals);
    return uint256(answer).mul(eurAccuracy).div(uint256(eurAnswer));
  }

  /**
   * @notice Converts asset balance into stablecoin balance at current price
   * @param _asset address to the collateral asset e.g. WETH
   * @param _amount amount of collateral
   */
  function convertFrom(address _asset, uint256 _amount) public view override returns (uint256) {
    uint256 price = getAssetPrice(_asset);
    uint8 collateralDecimals = ERC20(_asset).decimals();
    uint8 parDecimals = ERC20(address(a.stablex())).decimals(); // Needs re-casting because ISTABLEX does not expose decimals()
    uint8 oracleDecimals = assetOracles[_asset].decimals();
    uint256 parAccuracy = MathPow.pow(10, parDecimals);
    uint256 collateralAccuracy = MathPow.pow(10, oracleDecimals.add(collateralDecimals));
    return _amount.mul(price).mul(parAccuracy).div(collateralAccuracy);
  }

  /**
   * @notice Converts stablecoin balance into collateral balance at current price
   * @param _asset address to the collateral asset e.g. WETH
   * @param _amount amount of stablecoin
   */
  function convertTo(address _asset, uint256 _amount) public view override returns (uint256) {
    uint256 price = getAssetPrice(_asset);
    uint8 collateralDecimals = ERC20(_asset).decimals();
    uint8 parDecimals = ERC20(address(a.stablex())).decimals(); // Needs re-casting because ISTABLEX does not expose decimals()
    uint8 oracleDecimals = assetOracles[_asset].decimals();
    uint256 parAccuracy = MathPow.pow(10, parDecimals);
    uint256 collateralAccuracy = MathPow.pow(10, oracleDecimals.add(collateralDecimals));
    return _amount.mul(collateralAccuracy).div(price).div(parAccuracy);
  }
}
