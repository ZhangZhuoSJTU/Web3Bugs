pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import '@uniswap/lib/contracts/libraries/Babylonian.sol';

import "./Permissions.sol";
import "./interfaces/IAuction.sol";
import "./interfaces/IDexHandler.sol";
import "./interfaces/IMaltDataLab.sol";
import "./libraries/UniswapV2Library.sol";
import "./interfaces/IBurnMintableERC20.sol";


/// @title Liquidity Extension
/// @author 0xScotch <scotch@malt.money>
/// @notice In charge of facilitating a premium with net supply contraction during auctions
contract LiquidityExtension is Initializable, Permissions {
  ERC20 public collateralToken;
  IBurnMintableERC20 public malt;
  IAuction public auction;
  IDexHandler public dexHandler;
  IMaltDataLab public maltDataLab;
  address public uniswapV2Factory;

  uint256 public minReserveRatio = 40;

  event SetAuction(address auction);
  event SetDexHandler(address dexHandler);
  event SetMaltDataLab(address dataLab);
  event SetMinReserveRatio(uint256 ratio);
  event BurnMalt(uint256 purchased);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _auction,
    address _collateralToken,
    address _malt,
    address _dexHandler,
    address _maltDataLab,
    address _uniswapV2Factory
  ) external initializer {
    _adminSetup(_timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);
    _setupRole(AUCTION_ROLE, _auction);

    collateralToken = ERC20(_collateralToken);
    malt = IBurnMintableERC20(_malt);
    auction = IAuction(_auction);
    dexHandler = IDexHandler(_dexHandler);
    maltDataLab = IMaltDataLab(_maltDataLab);
    uniswapV2Factory = _uniswapV2Factory;
  }

  /*
   * PUBLIC VIEW METHODS
   */
  function hasMinimumReserves() public view returns (bool) {
    (uint256 rRatio, uint256 decimals) = reserveRatio();
    return rRatio >= minReserveRatio.mul(10**decimals).div(100);
  }

  function collateralDeficit() public view returns (uint256 deficit, uint256 decimals) {
    // Returns the amount of collateral token required to reach minimum reserves
    // Returns 0 if liquidity extension contains minimum reserves.
    uint256 balance = collateralToken.balanceOf(address(this));
    uint256 collateralDecimals = collateralToken.decimals();

    // TODO use data lab Mon 11 Oct 2021 16:48:08 BST
    (uint256 maltSupply, uint256 collateralSupply) = UniswapV2Library.getReserves(
      uniswapV2Factory,
      address(malt),
      address(collateralToken)
    );

    uint256 k = maltSupply.mul(collateralSupply);
    uint256 priceTarget = maltDataLab.priceTarget();

    uint256 fullCollateral = Babylonian.sqrt(k.mul(10**collateralDecimals).div(priceTarget));

    uint256 minReserves = fullCollateral.mul(minReserveRatio).div(100);

    if (minReserves > balance) {
      return (minReserves - balance, collateralDecimals);
    }

    return (0, collateralDecimals);
  }

  function reserveRatio() public view returns (uint256, uint256) {
    uint256 balance = collateralToken.balanceOf(address(this));
    uint256 collateralDecimals = collateralToken.decimals();

    // TODO use data lab Mon 11 Oct 2021 16:48:08 BST
    (uint256 maltSupply, uint256 collateralSupply) = UniswapV2Library.getReserves(
      uniswapV2Factory,
      address(malt),
      address(collateralToken)
    );

    uint256 k = maltSupply.mul(collateralSupply);
    uint256 priceTarget = maltDataLab.priceTarget();

    uint256 fullCollateral = Babylonian.sqrt(k.mul(10**collateralDecimals).div(priceTarget));

    uint256 rRatio = balance.mul(10**collateralDecimals).div(fullCollateral);
    return (rRatio, collateralDecimals);
  }

  /*
   * PRIVILEDGED METHODS
   */
  function purchaseAndBurn(uint256 amount)
    external
    onlyRole(AUCTION_ROLE, "Must have auction privs")
    returns (uint256 purchased)
  {
    require(collateralToken.balanceOf(address(this)) >= amount, "Insufficient balance");
    collateralToken.safeTransfer(address(dexHandler), amount);
    purchased = dexHandler.buyMalt();
    malt.burn(address(this), purchased);

    emit BurnMalt(purchased);
  }

  function setAuction(address _auction)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_auction != address(0), "Not address 0");
    auction = IAuction(_auction);
    emit SetAuction(_auction);
  }

  function setDexHandler(address _dexHandler)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_dexHandler != address(0), "Not address 0");
    dexHandler = IDexHandler(_dexHandler);
    emit SetDexHandler(_dexHandler);
  }

  function setMaltDataLab(address _dataLab)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_dataLab != address(0), "Not address 0");
    maltDataLab = IMaltDataLab(_dataLab);
    emit SetMaltDataLab(_dataLab);
  }

  function setMinReserveRatio(uint256 _ratio)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_ratio > 0 && _ratio <= 100, "Must be between 0 and 100");
    minReserveRatio = _ratio;
    emit SetMinReserveRatio(_ratio);
  }
}
