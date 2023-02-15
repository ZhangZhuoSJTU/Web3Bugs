pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./Permissions.sol";
import "./interfaces/IAuction.sol";
import "./interfaces/IMaltDataLab.sol";
import "./interfaces/IDAO.sol";
import "./interfaces/IRewardThrottle.sol";
import "./interfaces/IAuctionBurnReserveSkew.sol";
import "./interfaces/ILiquidityExtension.sol";
import "./interfaces/IImpliedCollateralService.sol";
import "./interfaces/IDexHandler.sol";
import "./interfaces/ISwingTrader.sol";
import "./interfaces/IBurnMintableERC20.sol";
import "./interfaces/ISupplyDistributionController.sol";
import "./interfaces/IAuctionStartController.sol";


/// @title Stabilizer Node
/// @author 0xScotch <scotch@malt.money>
/// @notice The backbone of the Malt stability system. In charge of triggering actions to stabilize price
contract StabilizerNode is Initializable, Permissions {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  uint256 internal stabilizeWindowEnd;
  uint256 public stabilizeBackoffPeriod = 5 * 60; // 5 minutes
  uint256 public upperStabilityThreshold = (10**18) / 100; // 1%
  uint256 public lowerStabilityThreshold = (10**18) / 100;
  uint256 public maxContributionBps = 70;
  uint256 public priceAveragePeriod = 5 minutes;
  uint256 public fastAveragePeriod = 30; // 30 seconds
  uint256 public overrideDistance = 20; // 2%

  uint256 public expansionDampingFactor = 1;

  uint256 public defaultIncentive = 100;

  uint256 public daoRewardCut;
  uint256 public lpRewardCut = 417;
  uint256 public auctionPoolRewardCut = 113;
  uint256 public swingTraderRewardCut = 417;
  uint256 public treasuryRewardCut = 50;
  uint256 public callerRewardCut = 3;

  uint256 public lastStabilize;

  ERC20 public rewardToken;
  IBurnMintableERC20 public malt;
  IAuction public auction;
  IDexHandler public dexHandler;
  IDAO public dao;
  address public uniswapV2Factory;
  ILiquidityExtension public liquidityExtension;
  IMaltDataLab public maltDataLab;
  IAuctionBurnReserveSkew public auctionBurnReserveSkew;
  IRewardThrottle public rewardThrottle;
  ISwingTrader public swingTrader;
  IImpliedCollateralService public impliedCollateralService;

  address payable public treasuryMultisig;
  address public auctionPool;
  address public supplyDistributionController;
  address public auctionStartController;

  event MintMalt(uint256 amount);
  event Stabilize(uint256 timestamp, uint256 exchangeRate);
  event RewardDistribution(uint256 rewarded);
  event SetAnnualYield(uint256 yield);
  event SetStabilizeBackoff(uint256 period);
  event SetAuctionBurnSkew(address auctionBurnReserveSkew);
  event SetRewardCut(uint256 daoCut, uint256 lpCut, uint256 callerCut, uint256 treasuryCut, uint256 auctionPoolCut, uint256 swingTraderCut);
  event SetTreasury(address newTreasury);
  event SetDefaultIncentive(uint256 incentive);
  event SetExpansionDamping(uint256 amount);
  event SetNewMaltDataLab(address dataLab);
  event SetAuctionContract(address auction);
  event SetDexHandler(address dexHandler);
  event SetDao(address dao);
  event SetLiquidityExtension(address liquidityExtension);
  event SetRewardThrottle(address rewardThrottle);
  event SetSwingTrader(address swingTrader);
  event SetPriceAveragePeriod(uint256 period);
  event SetOverrideDistance(uint256 distance);
  event SetFastAveragePeriod(uint256 period);
  event SetStabilityThresholds(uint256 upper, uint256 lower);
  event SetAuctionPool(address auctionPool);
  event SetMaxContribution(uint256 maxContribution);
  event SetImpliedCollateralService(address impliedCollateralService);
  event SetSupplyDistributionController(address _controller);
  event SetAuctionStartController(address _controller);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _rewardToken,
    address _malt,
    address _auction,
    address _uniswapV2Factory,
    address payable _treasuryMultisig,
    address _auctionPool
  ) external initializer {
    _adminSetup(_timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);
    _setupRole(AUCTION_ROLE, _auction);

    rewardToken = ERC20(_rewardToken);
    malt = IBurnMintableERC20(_malt);
    auction = IAuction(_auction);

    uniswapV2Factory = _uniswapV2Factory;
    treasuryMultisig = _treasuryMultisig;
    auctionPool = _auctionPool;

    lastStabilize = block.timestamp;
  }

  function setupContracts(
    address _dexHandler,
    address _maltDataLab,
    address _auctionBurnReserveSkew,
    address _rewardThrottle,
    address _dao,
    address _swingTrader,
    address _liquidityExtension,
    address _impliedCollateralService
  ) external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    dexHandler = IDexHandler(_dexHandler);
    maltDataLab = IMaltDataLab(_maltDataLab);
    auctionBurnReserveSkew = IAuctionBurnReserveSkew(_auctionBurnReserveSkew);
    rewardThrottle = IRewardThrottle(_rewardThrottle);
    dao = IDAO(_dao);
    swingTrader = ISwingTrader(_swingTrader);
    liquidityExtension = ILiquidityExtension(_liquidityExtension);
    impliedCollateralService = IImpliedCollateralService(_impliedCollateralService);
  }

  function stabilize() external notSameBlock {
    auction.checkAuctionFinalization();

    require(
      block.timestamp >= stabilizeWindowEnd || _stabilityWindowOverride(),
      "Can't call stabilize"
    );
    stabilizeWindowEnd = block.timestamp + stabilizeBackoffPeriod;

    rewardThrottle.checkRewardUnderflow();

    uint256 exchangeRate = maltDataLab.maltPriceAverage(priceAveragePeriod);

    if (!_shouldAdjustSupply(exchangeRate)) {
      maltDataLab.trackReserveRatio();

      lastStabilize = block.timestamp;
      return;
    }

    emit Stabilize(block.timestamp, exchangeRate);

    if (exchangeRate > maltDataLab.priceTarget()) {
      _distributeSupply();
    } else {
      _startAuction();
    }

    lastStabilize = block.timestamp;
  }

  /*
   * INTERNAL VIEW FUNCTIONS
   */
  function _stabilityWindowOverride() internal view returns (bool) {
    if (hasRole(ADMIN_ROLE, _msgSender())) {
      // Admin can always stabilize
      return true;
    }
    // Must have elapsed at least one period of the moving average before we stabilize again
    if (block.timestamp < lastStabilize + fastAveragePeriod) {
      return false;
    }

    uint256 priceTarget = maltDataLab.priceTarget();
    uint256 exchangeRate = maltDataLab.maltPriceAverage(fastAveragePeriod);

    uint256 upperThreshold = priceTarget.mul(1000 + overrideDistance).div(1000);
    uint256 lowerThreshold = priceTarget.mul(1000 - overrideDistance).div(1000);

    return exchangeRate <= lowerThreshold || exchangeRate >= upperThreshold;
  }

  function _shouldAdjustSupply(uint256 exchangeRate) internal view returns (bool) {
    uint256 decimals = rewardToken.decimals();
    uint256 priceTarget = maltDataLab.priceTarget();

    uint256 upperThreshold = priceTarget.mul(upperStabilityThreshold).div(10**decimals);
    uint256 lowerThreshold = priceTarget.mul(lowerStabilityThreshold).div(10**decimals);

    return (exchangeRate <= priceTarget.sub(lowerThreshold) && !auction.auctionActive(auction.currentAuctionId())) || exchangeRate >= priceTarget.add(upperThreshold);
  }

  /*
   * INTERNAL FUNCTIONS
   */
  function _distributeSupply() internal {
    if (supplyDistributionController != address(0)) {
      bool success = ISupplyDistributionController(supplyDistributionController).check();
      if (!success) {
        return;
      }
    }

    uint256 priceTarget = maltDataLab.priceTarget();
    uint256 tradeSize = dexHandler.calculateMintingTradeSize(priceTarget).div(expansionDampingFactor);

    if (tradeSize == 0) {
      return;
    }

    uint256 swingAmount = swingTrader.sellMalt(tradeSize);

    if (swingAmount >= tradeSize) {
      return;
    }

    tradeSize = tradeSize - swingAmount;

    malt.mint(address(dexHandler), tradeSize);
    emit MintMalt(tradeSize);
    uint256 rewards = dexHandler.sellMalt();

    auctionBurnReserveSkew.addAbovePegObservation(tradeSize);

    uint256 remaining = _replenishLiquidityExtension(rewards);

    _distributeRewards(remaining);

    maltDataLab.trackReserveRatio();
    impliedCollateralService.claim();
  }

  function _distributeRewards(uint256 rewarded) internal {
    if (rewarded == 0) {
      return;
    }
    rewardToken.approve(address(auction), rewarded);
    rewarded = auction.allocateArbRewards(rewarded);

    if (rewarded == 0) {
      return;
    }

    uint256 callerCut = rewarded.mul(callerRewardCut).div(1000);
    uint256 lpCut = rewarded.mul(lpRewardCut).div(1000);
    uint256 daoCut = rewarded.mul(daoRewardCut).div(1000);
    uint256 auctionPoolCut = rewarded.mul(auctionPoolRewardCut).div(1000);
    uint256 swingTraderCut = rewarded.mul(swingTraderRewardCut).div(1000);

    // Treasury gets paid after everyone else
    uint256 treasuryCut = rewarded - daoCut - lpCut - callerCut - auctionPoolCut - swingTraderCut;

    assert(treasuryCut <= rewarded);

    if (callerCut > 0) {
      rewardToken.safeTransfer(msg.sender, callerCut);
    }

    if (auctionPoolCut > 0) {
      rewardToken.safeTransfer(auctionPool, auctionPoolCut);
    }

    if (swingTraderCut > 0) {
      rewardToken.safeTransfer(address(swingTrader), swingTraderCut);
    }

    if (treasuryCut > 0) {
      rewardToken.safeTransfer(treasuryMultisig, treasuryCut);
    }

    if (daoCut > 0) {
      rewardToken.safeTransfer(address(dao), daoCut);
    }

    if (lpCut > 0) {
      rewardToken.safeTransfer(address(rewardThrottle), lpCut);
      rewardThrottle.handleReward();
    }

    emit RewardDistribution(rewarded);
  }

  function _replenishLiquidityExtension(uint256 rewards) internal returns (uint256 remaining) {
    if (liquidityExtension.hasMinimumReserves() || rewards == 0) {
      return rewards;
    }

    (uint256 deficit,) = liquidityExtension.collateralDeficit();

    uint256 maxContrib = rewards.mul(maxContributionBps).div(100);

    if (deficit >= maxContrib) {
      rewardToken.safeTransfer(address(liquidityExtension), maxContrib);
      return rewards - maxContrib;
    }

    rewardToken.safeTransfer(address(liquidityExtension), deficit);

    return rewards - deficit;
  }

  function _startAuction() internal {
    if (auctionStartController != address(0)) {
      bool success = IAuctionStartController(auctionStartController).checkForStart();
      if (!success) {
        return;
      }
    }

    uint256 priceTarget = maltDataLab.priceTarget();
    uint256 purchaseAmount = dexHandler.calculateBurningTradeSize(priceTarget);

    if (purchaseAmount == 0) {
      return;
    }

    uint256 decimals = rewardToken.decimals();

    uint256 amountUsed = swingTrader.buyMalt(purchaseAmount);

    purchaseAmount = purchaseAmount - amountUsed;

    if (purchaseAmount < 10**decimals) {
      return;
    }

    auction.triggerAuction(priceTarget, purchaseAmount);

    malt.mint(msg.sender, defaultIncentive*10**18);
    emit MintMalt(defaultIncentive*10**18);

    auctionBurnReserveSkew.addBelowPegObservation(purchaseAmount);

    maltDataLab.trackReserveRatio();
  }

  /*
   * PRIVILEDGED FUNCTIONS
   */
  function setStabilizeBackoff(uint256 _period)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_period > 0, "Must be greater than 0");
    stabilizeBackoffPeriod = _period;
    emit SetStabilizeBackoff(_period);
  }

  function setAuctionBurnSkew(address _auctionBurnReserveSkew)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    auctionBurnReserveSkew = IAuctionBurnReserveSkew(_auctionBurnReserveSkew);
    emit SetAuctionBurnSkew(_auctionBurnReserveSkew);
  }

  function setRewardCut(
    uint256 _daoCut,
    uint256 _lpCut,
    uint256 _callerCut,
    uint256 _auctionPoolCut,
    uint256 _swingTraderCut
  )
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    uint256 sum = _daoCut.add(_lpCut).add(_callerCut).add(_auctionPoolCut).add(_swingTraderCut);
    require(sum <= 1000, "Reward cut must be <= 100%");
    daoRewardCut = _daoCut;
    lpRewardCut = _lpCut;
    callerRewardCut = _callerCut;
    auctionPoolRewardCut = _auctionPoolCut;
    swingTraderRewardCut = _swingTraderCut;
    treasuryRewardCut = 1000 - sum;

    emit SetRewardCut(_daoCut, _lpCut, _callerCut, treasuryRewardCut, _auctionPoolCut, _swingTraderCut);
  }

  function setTreasury(address payable _newTreasury)
    external
    onlyRole(TIMELOCK_ROLE, "Must have timelock role")
  {
    treasuryMultisig = _newTreasury;
    emit SetTreasury(_newTreasury);
  }

  function setDefaultIncentive(uint256 _incentive)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_incentive > 0, "No negative incentive");

    defaultIncentive = _incentive;

    emit SetDefaultIncentive(_incentive);
  }

  function setExpansionDamping(uint256 amount)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(amount > 0, "No negative damping");

    expansionDampingFactor = amount;
    emit SetExpansionDamping(amount);
  }

  function setNewDataLab(address _dataLab)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    maltDataLab = IMaltDataLab(_dataLab);
    emit SetNewMaltDataLab(_dataLab);
  }

  function setAuctionContract(address _auction)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {

    if (address(auction) != address(0)) {
      revokeRole(AUCTION_ROLE, address(auction));
    }

    auction = IAuction(_auction);
    _setupRole(AUCTION_ROLE, _auction);
    emit SetAuctionContract(_auction);
  }

  function setStabilityThresholds(uint256 _upper, uint256 _lower)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_upper > 0 && _lower > 0, "Must be above 0");

    upperStabilityThreshold = _upper;
    lowerStabilityThreshold = _lower;
    emit SetStabilityThresholds(_upper, _lower);
  }

  function setAuctionPool(address _auctionPool)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_auctionPool != address(0), "Not address 0");

    auctionPool = _auctionPool;
    emit SetAuctionPool(_auctionPool);
  }

  function setSupplyDistributionController(address _controller)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    // This is allowed to be set to address(0) as its checked before calling methods on it
    supplyDistributionController = _controller;
    emit SetSupplyDistributionController(_controller);
  }

  function setAuctionStartController(address _controller)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    // This is allowed to be set to address(0) as its checked before calling methods on it
    auctionStartController = _controller;
    emit SetAuctionStartController(_controller);
  }

  function setMaxContribution(uint256 _maxContribution)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_maxContribution > 0 && _maxContribution <= 100, "Must be between 0 and 100");

    maxContributionBps = _maxContribution;
    emit SetMaxContribution(_maxContribution);
  }

  function setDexHandler(address _dexHandler)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_dexHandler != address(0), "Not address 0");
    dexHandler = IDexHandler(_dexHandler);
    emit SetDexHandler(_dexHandler);
  }

  function setDao(address _dao)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_dao != address(0), "Not address 0");
    dao = IDAO(_dao);
    emit SetDao(_dao);
  }

  function setLiquidityExtension(address _liquidityExtension)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_liquidityExtension != address(0), "Not address 0");
    liquidityExtension = ILiquidityExtension(_liquidityExtension);
    emit SetLiquidityExtension(_liquidityExtension);
  }

  function setRewardThrottle(address _rewardThrottle)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_rewardThrottle != address(0), "Not address 0");
    rewardThrottle = IRewardThrottle(_rewardThrottle);
    emit SetRewardThrottle(_rewardThrottle);
  }

  function setSwingTrader(address _swingTrader)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_swingTrader != address(0), "Not address 0");
    swingTrader = ISwingTrader(_swingTrader);
    emit SetSwingTrader(_swingTrader);
  }

  function setImpliedCollateralService(address _impliedCollateralService)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_impliedCollateralService != address(0), "Not address 0");
    impliedCollateralService = IImpliedCollateralService(_impliedCollateralService);
    emit SetImpliedCollateralService(_impliedCollateralService);
  }

  function setPriceAveragePeriod(uint256 _period)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_period > 0, "Cannot have 0 period");
    priceAveragePeriod = _period;
    emit SetPriceAveragePeriod(_period);
  }

  function setOverrideDistance(uint256 _distance)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_distance > 0 && _distance < 1000, "Override must be between 0-100%");
    overrideDistance = _distance;
    emit SetOverrideDistance(_distance);
  }

  function setFastAveragePeriod(uint256 _period)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_period > 0, "Cannot have 0 period");
    fastAveragePeriod = _period;
    emit SetFastAveragePeriod(_period);
  }
}
