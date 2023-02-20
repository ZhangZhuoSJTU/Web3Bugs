//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "../interfaces/IInceptionVaultPriceFeed.sol";
import "../../chainlink/AggregatorV3Interface.sol";
import "../../interfaces/IAddressProvider.sol";
import "../../libraries/MathPow.sol";
import "../../libraries/WadRayMath.sol";

contract ChainlinkInceptionPriceFeed is IInceptionVaultPriceFeed, Initializable {
  using SafeMath for uint256;
  using SafeMath for uint8;
  using WadRayMath for uint256;

  uint256 private constant _PRICE_ORACLE_STALE_THRESHOLD = 1 days;

  IAddressProvider private _a;

  ERC20 private _inceptionCollateral;

  AggregatorV3Interface private _assetOracle;

  AggregatorV3Interface private _eurOracle;

  function initialize(
    IAddressProvider _addresses,
    address inceptionCollateral,
    address assetOracle,
    AggregatorV3Interface eurOracle
  ) external override initializer {
    _a = _addresses;
    _inceptionCollateral = ERC20(inceptionCollateral);
    _assetOracle = AggregatorV3Interface(assetOracle);
    _eurOracle = eurOracle;
  }

  /**
   * @notice Converts asset balance into stablecoin balance at current price
   * @param _amount amount of collateral
   */
  function convertFrom(uint256 _amount) external view override returns (uint256) {
    uint256 price = getAssetPrice();
    uint8 collateralDecimals = ERC20(_inceptionCollateral).decimals();
    uint8 parDecimals = ERC20(address(_a.stablex())).decimals(); // Needs re-casting because ISTABLEX does not expose decimals()
    uint8 oracleDecimals = _assetOracle.decimals();
    uint256 parAccuracy = MathPow.pow(10, parDecimals);
    uint256 collateralAccuracy = MathPow.pow(10, oracleDecimals.add(collateralDecimals));
    return _amount.mul(price).mul(parAccuracy).div(collateralAccuracy);
  }

  /**
   * @notice Converts stablecoin balance into collateral balance at current price
   * @param _amount amount of stablecoin
   */
  function convertTo(uint256 _amount) external view override returns (uint256) {
    uint256 price = getAssetPrice();
    uint8 collateralDecimals = ERC20(_inceptionCollateral).decimals();
    uint8 parDecimals = ERC20(address(_a.stablex())).decimals(); // Needs re-casting because ISTABLEX does not expose decimals()
    uint8 oracleDecimals = _assetOracle.decimals();
    uint256 parAccuracy = MathPow.pow(10, parDecimals);
    uint256 collateralAccuracy = MathPow.pow(10, oracleDecimals.add(collateralDecimals));
    return _amount.mul(collateralAccuracy).div(price).div(parAccuracy);
  }

  /**
   * Gets the asset price in EUR (PAR)
   * @dev returned value has matching decimals to the asset oracle (not the EUR oracle)
   */
  function getAssetPrice() public view override returns (uint256 price) {
    (, int256 eurAnswer, , uint256 eurUpdatedAt, ) = _eurOracle.latestRoundData();
    require(eurAnswer > 0, "EUR price data not valid");
    require(block.timestamp - eurUpdatedAt < _PRICE_ORACLE_STALE_THRESHOLD, "EUR price data is stale");

    (, int256 answer, , uint256 assetUpdatedAt, ) = _assetOracle.latestRoundData();
    require(answer > 0, "Price data not valid");
    require(block.timestamp - assetUpdatedAt < _PRICE_ORACLE_STALE_THRESHOLD, "Price data is stale");

    uint8 eurDecimals = _eurOracle.decimals();
    uint256 eurAccuracy = MathPow.pow(10, eurDecimals);
    return uint256(answer).mul(eurAccuracy).div(uint256(eurAnswer));
  }

  function a() public view override returns (IAddressProvider) {
    return _a;
  }

  function inceptionCollateral() public view override returns (ERC20) {
    return _inceptionCollateral;
  }

  function assetOracle() public view override returns (AggregatorV3Interface) {
    return _assetOracle;
  }

  function eurOracle() public view override returns (AggregatorV3Interface) {
    return _eurOracle;
  }
}
