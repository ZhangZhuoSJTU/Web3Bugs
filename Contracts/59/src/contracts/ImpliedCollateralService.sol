pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./Permissions.sol";
import "./interfaces/IAuction.sol";
import "./interfaces/IAuctionPool.sol";
import "./interfaces/IOverflow.sol";
import "./interfaces/IBurnMintableERC20.sol";
import "./interfaces/IRewardThrottle.sol";
import "./interfaces/ISwingTrader.sol";
import "./interfaces/ILiquidityExtension.sol";
import "./interfaces/IMaltDataLab.sol";


/// @title Implied Collateral Service
/// @author 0xScotch <scotch@malt.money>
/// @notice A contract that provides an abstraction above individual implied collateral sources
contract ImpliedCollateralService is Initializable, Permissions {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  ERC20 public collateralToken;
  IBurnMintableERC20 public malt;
  IAuctionPool public auctionPool;
  IOverflow public rewardOverflow;
  ISwingTrader public swingTrader;
  ILiquidityExtension public liquidityExtension;
  IMaltDataLab public maltDataLab;

  event SetAuctionPool(address auctionPool);
  event SetRewardOverflow(address rewardOverflow);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _collateralToken,
    address _malt,
    address _auction,
    address _auctionPool,
    address _rewardOverflow,
    address _swingTrader,
    address _liquidityExtension,
    address _maltDataLab
  ) external initializer {
    _adminSetup(_timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);
    _setupRole(AUCTION_ROLE, _auction);

    collateralToken = ERC20(_collateralToken);
    malt = IBurnMintableERC20(_malt);
    auctionPool = IAuctionPool(_auctionPool);
    rewardOverflow = IOverflow(_rewardOverflow);
    swingTrader = ISwingTrader(_swingTrader);
    liquidityExtension = ILiquidityExtension(_liquidityExtension);
    maltDataLab = IMaltDataLab(_maltDataLab);
  }

  function handleDeficit(uint256 maxAmount) external onlyRole(AUCTION_ROLE, "Must have auction role privs") {
    if (maxAmount > 0) {
      maxAmount = auctionPool.purchaseArbitrageTokens(maxAmount);
    }

    if (maxAmount > 0) {
      maxAmount = rewardOverflow.purchaseArbitrageTokens(maxAmount);

      // if (maxAmount > 0) {
      //   // TODO IDEA: pull reward out of distributor into auction Pool Tue 16 Nov 2021 00:16:03 GMT
      //   maxAmount = distributor.requestCapital(maxAmount);
      //   if (maxAmount > 0) {
      //     maxAmount = rewardOverflow.purchaseArbitrageTokens(maxAmount);
      //   }
      // }
    }
  }

  function claim() external {
    auctionPool.claim();
    rewardOverflow.claim();
  }

  function setAuctionPool(address _auctionPool)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_auctionPool != address(0), "Not 0 address");
    auctionPool = IAuctionPool(_auctionPool);
    emit SetAuctionPool(_auctionPool);
  }

  function setRewardOverflow(address _rewardOverflow)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_rewardOverflow != address(0), "Not 0 address");
    rewardOverflow = IOverflow(_rewardOverflow);
    emit SetRewardOverflow(_rewardOverflow);
  }

  function getCollateralValueInMalt() public view returns (uint256 collateral) {
    uint256 maltPrice = maltDataLab.smoothedMaltPrice();
    uint256 target = maltDataLab.priceTarget();

    uint256 auctionPoolBalance = collateralToken.balanceOf(address(auctionPool)).mul(target).div(maltPrice);
    uint256 overflowBalance = collateralToken.balanceOf(address(rewardOverflow)).mul(target).div(maltPrice);
    uint256 liquidityExtensionBalance = collateralToken.balanceOf(address(liquidityExtension)).mul(target).div(maltPrice);
    uint256 swingTraderBalance = collateralToken.balanceOf(address(swingTrader)).mul(target).div(maltPrice);
    uint256 swingTraderMaltBalance = malt.balanceOf(address(swingTrader));

    return auctionPoolBalance + overflowBalance + liquidityExtensionBalance + swingTraderBalance + swingTraderMaltBalance;
  }

  function totalUsefulCollateral() public view returns (uint256 collateral) {
    uint256 auctionPoolBalance = collateralToken.balanceOf(address(auctionPool));
    uint256 overflowBalance = collateralToken.balanceOf(address(rewardOverflow));
    uint256 liquidityExtensionBalance = collateralToken.balanceOf(address(liquidityExtension));
    uint256 swingTraderBalance = collateralToken.balanceOf(address(swingTrader));

    return auctionPoolBalance + overflowBalance + liquidityExtensionBalance + swingTraderBalance;
  }
}
