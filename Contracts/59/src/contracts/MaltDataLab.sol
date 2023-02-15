pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import "./interfaces/IStabilizerNode.sol";
import "./interfaces/IMovingAverage.sol";
import "./interfaces/IDAO.sol";
import "./interfaces/IBurnMintableERC20.sol";
import "./interfaces/ILiquidityExtension.sol";

import "./libraries/UniswapV2Library.sol";
import "./libraries/SafeBurnMintableERC20.sol";

import "./Permissions.sol";


/// @title Malt Data Lab
/// @author 0xScotch <scotch@malt.money>
/// @notice The central source of all of Malt protocol's internal data needs
/// @dev Over time usage of MovingAverage will likely be replaced with more reliable oracles
contract MaltDataLab is Initializable, Permissions {
  using SafeMath for uint256;
  using SafeBurnMintableERC20 for IBurnMintableERC20;

  bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

  IBurnMintableERC20 public rewardToken;
  IBurnMintableERC20 public malt;
  ILiquidityExtension public liquidityExtension;
  IUniswapV2Pair public stakeToken;

  IMovingAverage public reserveRatioMA;
  IMovingAverage public maltPriceMA;
  IMovingAverage public poolMaltReserveMA;

  uint256 public priceTarget = 10**18; // $1
  uint256 public reserveRatioLookback = 10 minutes;
  uint256 public maltPriceLookback = 10 minutes;
  uint256 public reserveLookback = 10 minutes;

  event TrackMaltPrice(uint256 price);
  event TrackPoolReserves(uint256 maltReserves, uint256 rewardReserves);
  event TrackReserveRatio(uint256 rRatio, uint256 decimals);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _malt,
    address _rewardToken,
    address _stakeToken,
    uint256 _priceTarget,
    address _liquidityExtension,
    address _reserveRatioMA,
    address _maltPriceMA,
    address _poolMaltReserveMA,
    address _updater
  ) external initializer {
    _adminSetup(_timelock);
    _setupRole(ADMIN_ROLE, initialAdmin);
    _roleSetup(UPDATER_ROLE, _updater);
    _roleSetup(UPDATER_ROLE, initialAdmin);

    stakeToken = IUniswapV2Pair(_stakeToken);
    malt = IBurnMintableERC20(_malt);
    rewardToken = IBurnMintableERC20(_rewardToken);
    priceTarget = _priceTarget;
    liquidityExtension = ILiquidityExtension(_liquidityExtension);
    reserveRatioMA = IMovingAverage(_reserveRatioMA);
    maltPriceMA = IMovingAverage(_maltPriceMA);
    poolMaltReserveMA = IMovingAverage(_poolMaltReserveMA);
  }

  function smoothedReserveRatio() public view returns (uint256) {
    return reserveRatioMA.getValueWithLookback(reserveRatioLookback);
  }

  function smoothedMaltPrice() public view returns (uint256) {
    return maltPriceMA.getValueWithLookback(maltPriceLookback);
  }

  function smoothedMaltInPool() public view returns (uint256) {
    return poolMaltReserveMA.getValueWithLookback(reserveLookback);
  }

  function smoothedReserves() public view returns (uint256 maltReserves, uint256 collateralReserves) {
    maltReserves = poolMaltReserveMA.getValueWithLookback(reserveLookback);
    uint256 price = smoothedMaltPrice();
    return (maltReserves, maltReserves.mul(price).div(priceTarget));
  }

  function reserveRatioAverage(uint256 _lookback) public view returns (uint256) {
    return reserveRatioMA.getValueWithLookback(_lookback);
  }

  function maltPriceAverage(uint256 _lookback) public view returns (uint256) {
    return maltPriceMA.getValueWithLookback(_lookback);
  }

  function maltInPoolAverage(uint256 _lookback) public view returns (uint256) {
    return poolMaltReserveMA.getValueWithLookback(_lookback);
  }

  function realValueOfLPToken(uint256 amount) external view returns (uint256) {
    uint256 maltPrice = smoothedMaltPrice();
    (uint256 maltReserves, uint256 rewardReserves) = smoothedReserves();

    if (maltReserves == 0) {
      return 0;
    }

    uint256 totalLPSupply = stakeToken.totalSupply();

    uint256 maltValue = amount.mul(maltReserves).div(totalLPSupply);
    uint256 rewardValue = amount.mul(rewardReserves).div(totalLPSupply);

    return rewardValue.add(maltValue.mul(maltPrice).div(priceTarget));
  }

  /*
   * Public mutation methods
   */
  function trackReserveRatio() public {
    (uint256 reserveRatio, uint256 decimals) = liquidityExtension.reserveRatio();

    reserveRatioMA.update(reserveRatio);

    emit TrackReserveRatio(reserveRatio, decimals);
  }

  function trackMaltPrice()
    external 
    onlyRole(UPDATER_ROLE, "Must have updater role")
  {
    (uint256 reserve0, uint256 reserve1,) = stakeToken.getReserves();
    (address token0,) = UniswapV2Library.sortTokens(address(malt), address(rewardToken));
    uint256 rewardDecimals = rewardToken.decimals();

    if (token0 == address(rewardToken)) {
      uint256 price = _normalizedPrice(reserve0, reserve1, rewardDecimals);
      maltPriceMA.update(price);
      emit TrackMaltPrice(price);
    } else {
      uint256 price = _normalizedPrice(reserve1, reserve0, rewardDecimals);
      maltPriceMA.update(price);

      emit TrackMaltPrice(price);
    }
  }

  function trackPoolReserves()
    external 
    onlyRole(UPDATER_ROLE, "Must have updater role")
  {
    (uint256 reserve0, uint256 reserve1,) = stakeToken.getReserves();
    (address token0,) = UniswapV2Library.sortTokens(address(malt), address(rewardToken));
    uint256 rewardDecimals = rewardToken.decimals();

    if (token0 == address(rewardToken)) {
      // Args are (maltReserve)
      poolMaltReserveMA.update(reserve1);
      emit TrackPoolReserves(reserve1, reserve0);
    } else {
      // Args are (maltReserve)
      poolMaltReserveMA.update(reserve0);
      emit TrackPoolReserves(reserve0, reserve1);
    }
  }

  function trackPool()
    external 
    onlyRole(UPDATER_ROLE, "Must have updater role")
  {
    (uint256 reserve0, uint256 reserve1,) = stakeToken.getReserves();
    (address token0,) = UniswapV2Library.sortTokens(address(malt), address(rewardToken));
    uint256 rewardDecimals = rewardToken.decimals();

    if (token0 == address(rewardToken)) {
      uint256 price = _normalizedPrice(reserve0, reserve1, rewardDecimals);
      maltPriceMA.update(price);

      // Args are (maltReserve)
      poolMaltReserveMA.update(reserve1);
      emit TrackMaltPrice(price);
      emit TrackPoolReserves(reserve1, reserve0);
    } else {
      uint256 price = _normalizedPrice(reserve1, reserve0, rewardDecimals);
      maltPriceMA.update(price);

      // Args are (maltReserve)
      poolMaltReserveMA.update(reserve0);
      emit TrackMaltPrice(price);
      emit TrackPoolReserves(reserve0, reserve1);
    }
  }

  /*
   * INTERNAL METHODS
   */
  function _normalizedPrice(
    uint256 numerator,
    uint256 denominator,
    uint256 decimals
  ) internal view returns(uint256 price) {
    // Malt is 18 decimals
    if (decimals > 18) {
      uint256 diff = decimals - 18;
      price = numerator.mul(10**decimals).div(denominator.mul(10**diff));
    } else if (decimals < 18) {
      uint256 diff = 18 - decimals;
      price = (numerator.mul(10**diff)).mul(10**decimals).div(denominator);
    } else {
      price = numerator.mul(10**decimals).div(denominator);
    }
  }

  /*
   * PRIVILEDGED METHODS
   */
  function setLiquidityExtension(address _liquidityExtension) 
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_liquidityExtension != address(0), "Must be a valid address");
    liquidityExtension = ILiquidityExtension(_liquidityExtension);
  }

  function setPriceTarget(uint256 _price)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_price > 0, "Cannot have 0 price");
    priceTarget = _price;
  }

  function setReserveRatioLookback(uint256 _lookback)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_lookback > 0, "Cannot have 0 lookback");
    reserveRatioLookback = _lookback;
  }

  function setMaltPriceLookback(uint256 _lookback)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_lookback > 0, "Cannot have 0 lookback");
    maltPriceLookback = _lookback;
  }

  function setReserveLookback(uint256 _lookback)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_lookback > 0, "Cannot have 0 lookback");
    reserveLookback = _lookback;
  }

  function setReserveAverageContract(address _reserveRatioMA)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_reserveRatioMA != address(0), "Cannot use 0 address");
    reserveRatioMA = IMovingAverage(_reserveRatioMA);
  }

  function setMaltPriceAverageContract(address _maltPriceMA)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_maltPriceMA != address(0), "Cannot use 0 address");
    maltPriceMA = IMovingAverage(_maltPriceMA);
  }

  function setMaltReservesAverageContract(address _poolMaltReserveMA)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_poolMaltReserveMA != address(0), "Cannot use 0 address");
    poolMaltReserveMA = IMovingAverage(_poolMaltReserveMA);
  }
}
