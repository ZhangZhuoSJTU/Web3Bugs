pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/Math.sol";

import "./Permissions.sol";
import "./interfaces/IAuction.sol";
import "./interfaces/IBurnMintableERC20.sol";
import "./interfaces/IMaltDataLab.sol";
import "./interfaces/IDexHandler.sol";
import "./interfaces/ILiquidityExtension.sol";
import "./interfaces/IImpliedCollateralService.sol";
import "./interfaces/IAuctionBurnReserveSkew.sol";
import "./interfaces/IAuctionStartController.sol";


struct AccountCommitment {
  uint256 commitment;
  uint256 redeemed;
  uint256 maltPurchased;
}

struct AuctionData {
  // The full amount of commitments required to return to peg
  uint256 fullRequirement;
  // total maximum desired commitments to this auction
  uint256 maxCommitments;
  // Quantity of sale currency committed to this auction
  uint256 commitments;
  // Malt purchased and burned using current commitments
  uint256 maltPurchased;
  // Desired starting price for the auction
  uint256 startingPrice;
  // Desired lowest price for the arbitrage token
  uint256 endingPrice;
  // Price of arbitrage tokens at conclusion of auction. This is either
  // when the duration elapses or the maxCommitments is reached
  uint256 finalPrice;
  // The peg price for the liquidity pool
  uint256 pegPrice;
  // Time when auction started
  uint256 startingTime;
  uint256 endingTime;
  // Is the auction currently accepting commitments?
  bool active;
  // The reserve ratio at the start of the auction
  uint256 preAuctionReserveRatio;
  // Has this auction been finalized? Meaning any additional stabilizing
  // has been done
  bool finalized;
  // The amount of arb tokens that have been executed and are now claimable
  uint256 claimableTokens;
  // The finally calculated realBurnBudget
  uint256 finalBurnBudget;
  // The amount of Malt purchased with realBurnBudget
  uint256 finalPurchased;
  // A map of all commitments to this auction by specific accounts
  mapping(address => AccountCommitment) accountCommitments;
}


/// @title Malt Arbitrage Auction
/// @author 0xScotch <scotch@malt.money>
/// @notice The under peg Malt mechanism of dutch arbitrage auctions is implemented here
contract Auction is Initializable, Permissions {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  bytes32 public constant AUCTION_AMENDER_ROLE = keccak256("AUCTION_AMENDER_ROLE");

  address public stabilizerNode;
  address public amender;
  IMaltDataLab public maltDataLab;
  ERC20 public collateralToken;
  IBurnMintableERC20 public malt;
  IDexHandler public dexHandler;
  ILiquidityExtension public liquidityExtension;
  IImpliedCollateralService public impliedCollateralService;
  IAuctionBurnReserveSkew public auctionBurnReserveSkew;

  uint256 public unclaimedArbTokens;
  uint256 public replenishingAuctionId;
  uint256 public currentAuctionId;
  uint256 public claimableArbitrageRewards;
  uint256 public nextCommitmentId;
  uint256 public auctionLength = 600; // 10 minutes
  uint256 public arbTokenReplenishSplit = 7000; // 70%
  uint256 public maxAuctionEnd = 900; // 90% of target price
  uint256 public auctionEndReserveBps = 900; // 90% of collateral
  uint256 public priceLookback = 2 minutes;
  uint256 public reserveRatioLookback = 30; // 30 seconds
  uint256 public dustThreshold = 1e4;

  address public auctionStartController;

  mapping (uint256 => AuctionData) internal idToAuction;
  mapping(address => uint256[]) internal accountCommitmentEpochs;

  event AuctionCommitment(
    uint256 commitmentId,
    uint256 auctionId,
    address account,
    uint256 commitment,
    uint256 purchased
  );

  event ClaimArbTokens(
    uint256 auctionId,
    address account,
    uint256 amountTokens
  );

  event AuctionEnded(
    uint256 id,
    uint256 commitments,
    uint256 startingPrice,
    uint256 finalPrice,
    uint256 maltPurchased
  );

  event AuctionStarted(
    uint256 id,
    uint256 maxCommitments,
    uint256 startingPrice,
    uint256 endingPrice,
    uint256 startingTime,
    uint256 endingTime
  );

  event ArbTokenAllocation(
    uint256 replenishingAuctionId,
    uint256 maxArbAllocation
  );

  event SetAuctionLength(uint256 length);
  event SetStabilizerNode(address stabilizerNode);
  event SetMaltDataLab(address dataLab);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _collateralToken,
    address _malt,
    uint256 _auctionLength,
    address _stabilizerNode,
    address _maltDataLab,
    address _dexHandler,
    address _liquidityExtension,
    address _impliedCollateralService,
    address _auctionBurnReserveSkew,
    address _amender
  ) external initializer {
    _adminSetup(_timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);
    _setupRole(STABILIZER_NODE_ROLE, _stabilizerNode);
    _roleSetup(AUCTION_AMENDER_ROLE, _amender);

    collateralToken = ERC20(_collateralToken);
    malt = IBurnMintableERC20(_malt);
    auctionLength = _auctionLength;
    stabilizerNode = _stabilizerNode;
    maltDataLab = IMaltDataLab(_maltDataLab);
    dexHandler = IDexHandler(_dexHandler);
    liquidityExtension = ILiquidityExtension(_liquidityExtension);
    impliedCollateralService = IImpliedCollateralService(_impliedCollateralService);
    auctionBurnReserveSkew = IAuctionBurnReserveSkew(_auctionBurnReserveSkew);
    amender = _amender;
  }

  /*
   * PUBLIC METHODS
   */
  function purchaseArbitrageTokens(uint256 amount) external notSameBlock {
    require(auctionActive(currentAuctionId), "No auction running");

    uint256 realCommitment = _capCommitment(currentAuctionId, amount);

    collateralToken.safeTransferFrom(msg.sender, address(liquidityExtension), realCommitment);

    uint256 purchased = liquidityExtension.purchaseAndBurn(realCommitment);
    
    AuctionData storage auction = idToAuction[currentAuctionId];

    require(auction.startingTime <= now, "Auction hasn't started yet");
    require(auction.endingTime >= now, "Auction is already over");
    require(auction.active == true, "Auction is not active");

    auction.commitments = auction.commitments.add(realCommitment);

    if (auction.accountCommitments[msg.sender].commitment == 0) {
      accountCommitmentEpochs[msg.sender].push(currentAuctionId);
    }
    auction.accountCommitments[msg.sender].commitment = auction.accountCommitments[msg.sender].commitment.add(realCommitment);
    auction.accountCommitments[msg.sender].maltPurchased = auction.accountCommitments[msg.sender].maltPurchased.add(purchased);
    auction.maltPurchased = auction.maltPurchased.add(purchased);

    emit AuctionCommitment(
      nextCommitmentId,
      currentAuctionId,
      msg.sender,
      realCommitment,
      purchased
    );

    nextCommitmentId = nextCommitmentId + 1;

    if (auction.commitments >= auction.maxCommitments) {
      _endAuction(currentAuctionId) ;
    }
  }

  function claimArbitrage(uint256 _auctionId) external notSameBlock {
    uint256 amountTokens = userClaimableArbTokens(msg.sender, _auctionId);

    require(amountTokens > 0, "No claimable Arb tokens");

    AuctionData storage auction = idToAuction[_auctionId];

    require(!auction.active, "Cannot claim tokens on an active auction");

    AccountCommitment storage commitment = auction.accountCommitments[msg.sender];

    uint256 redemption = amountTokens.mul(auction.finalPrice).div(auction.pegPrice);
    uint256 remaining = commitment.commitment.sub(commitment.redeemed);

    require(redemption <= remaining.add(1), "Cannot claim more tokens than available");

    commitment.redeemed = commitment.redeemed.add(redemption);

    // Unclaimed represents total outstanding, but not necessarily
    // claimable yet.
    // claimableArbitrageRewards represents total amount that is now
    // available to be claimed
    if (amountTokens > unclaimedArbTokens) {
      unclaimedArbTokens = 0;
    } else {
      unclaimedArbTokens = unclaimedArbTokens.sub(amountTokens);
    }

    if (amountTokens > claimableArbitrageRewards) {
      claimableArbitrageRewards = 0;
    } else {
      claimableArbitrageRewards = claimableArbitrageRewards.sub(amountTokens);
    }

    collateralToken.safeTransfer(msg.sender, amountTokens);

    emit ClaimArbTokens(
      _auctionId,
      msg.sender,
      amountTokens
    );
  }

  /*
   * PUBLIC VIEW FUNCTIONS
   */
  function isAuctionFinished(uint256 _id) public view returns(bool) {
    AuctionData storage auction = idToAuction[_id];

    return auction.endingTime > 0 && (now >= auction.endingTime || auction.finalPrice > 0 || auction.commitments >= auction.maxCommitments);
  }

  function auctionActive(uint256 _id) public view returns (bool) {
    AuctionData storage auction = idToAuction[_id];
    
    return auction.active && now >= auction.startingTime;
  }

  function isAuctionFinalized(uint256 _id) public view returns (bool) {
    AuctionData storage auction = idToAuction[_id];
    return auction.finalized;
  }

  function userClaimableArbTokens(
    address account,
    uint256 auctionId
  ) public view returns (uint256) {
    AuctionData storage auction = idToAuction[auctionId];

    if (auction.claimableTokens == 0 || auction.finalPrice == 0 || auction.commitments == 0) {
      return 0;
    }

    AccountCommitment storage commitment = auction.accountCommitments[account];

    uint256 totalTokens = auction.commitments.mul(auction.pegPrice).div(auction.finalPrice);


    uint256 claimablePerc = auction.claimableTokens.mul(auction.pegPrice).div(totalTokens);

    uint256 price = auction.finalPrice;

    if (auction.finalPrice == 0) {
      price = currentPrice(auctionId);
    }

    uint256 amountTokens = commitment.commitment.mul(auction.pegPrice).div(price);
    uint256 redeemedTokens = commitment.redeemed.mul(auction.pegPrice).div(price);

    uint256 amountOut = amountTokens.mul(claimablePerc).div(auction.pegPrice).sub(redeemedTokens);

    // Avoid leaving dust behind
    if (amountOut < dustThreshold) {
      return 0;
    }

    return amountOut;
  }

  function balanceOfArbTokens(
    uint256 _auctionId,
    address account
  ) public view returns (uint256) {
    AuctionData storage auction = idToAuction[_auctionId];

    AccountCommitment storage commitment = auction.accountCommitments[account];

    uint256 remaining = commitment.commitment.sub(commitment.redeemed);

    uint256 price = auction.finalPrice;

    if (auction.finalPrice == 0) {
      price = currentPrice(_auctionId);
    }

    return remaining.mul(auction.pegPrice).div(price);
  }

  function averageMaltPrice(uint256 _id) external view returns (uint256) {
    AuctionData storage auction = idToAuction[_id];

    if (auction.maltPurchased == 0) {
      return 0;
    }

    return auction.commitments.mul(auction.pegPrice).div(auction.maltPurchased);
  }

  function currentPrice(uint256 _id) public view returns (uint256) {
    AuctionData storage auction = idToAuction[_id];

    if (auction.startingTime == 0) {
      return maltDataLab.priceTarget();
    }

    uint256 secondsSinceStart = 0;

    if (now > auction.startingTime) {
      secondsSinceStart = now - auction.startingTime;
    }

    uint256 auctionDuration = auction.endingTime - auction.startingTime;

    if (secondsSinceStart >= auctionDuration) {
      return auction.endingPrice;
    }

    uint256 totalPriceDelta = auction.startingPrice.sub(auction.endingPrice);

    uint256 currentPriceDelta = totalPriceDelta.mul(secondsSinceStart).div(auctionDuration);

    return auction.startingPrice.sub(currentPriceDelta);
  }

  function getAuctionCommitments(uint256 _id) public view returns (uint256 commitments, uint256 maxCommitments) {
    AuctionData storage auction = idToAuction[_id];

    return (auction.commitments, auction.maxCommitments);
  }

  function getAuctionPrices(uint256 _id) public view returns (uint256 startingPrice, uint256 endingPrice, uint256 finalPrice) {
    AuctionData storage auction = idToAuction[_id];

    return (auction.startingPrice, auction.endingPrice, auction.finalPrice);
  }

  function auctionExists(uint256 _id) public view returns (bool) {
    AuctionData storage auction = idToAuction[_id];

    return auction.startingTime > 0;
  }

  function getAccountCommitments(address account) external view returns (
    uint256[] memory auctions,
    uint256[] memory commitments,
    uint256[] memory awardedTokens,
    uint256[] memory redeemedTokens,
    uint256[] memory finalPrice,
    uint256[] memory claimable,
    bool[] memory finished
  ) {
    uint256[] memory epochCommitments = accountCommitmentEpochs[account];

    auctions = new uint256[](epochCommitments.length);
    commitments = new uint256[](epochCommitments.length);
    awardedTokens = new uint256[](epochCommitments.length);
    redeemedTokens = new uint256[](epochCommitments.length);
    finalPrice = new uint256[](epochCommitments.length);
    claimable = new uint256[](epochCommitments.length);
    finished = new bool[](epochCommitments.length);

    for (uint i = 0; i < epochCommitments.length; ++i) {
      AuctionData storage auction = idToAuction[epochCommitments[i]];

      AccountCommitment storage commitment = auction.accountCommitments[account];

      uint256 price = auction.finalPrice;

      if (auction.finalPrice == 0) {
        price = currentPrice(epochCommitments[i]);
      }

      auctions[i] = epochCommitments[i];
      commitments[i] = commitment.commitment;
      awardedTokens[i] = commitment.commitment.mul(auction.pegPrice).div(price);
      redeemedTokens[i] = commitment.redeemed.mul(auction.pegPrice).div(price);
      finalPrice[i] = price;
      claimable[i] = userClaimableArbTokens(account, epochCommitments[i]);
      finished[i] = isAuctionFinished(epochCommitments[i]);
    }
  }

  function getAccountCommitmentAuctions(address account) external view returns (uint[] memory) {
    return accountCommitmentEpochs[account];
  }

  function getAuctionParticipationForAccount(address account, uint256 auctionId) external view returns (
    uint256 commitment,
    uint256 redeemed,
    uint256 maltPurchased
  ) {
    AccountCommitment storage commitment = idToAuction[auctionId].accountCommitments[account];

    return (commitment.commitment, commitment.redeemed, commitment.maltPurchased);
  }

  function getActiveAuction() external view returns (
    uint256 auctionId,
    uint256 maxCommitments,
    uint256 commitments,
    uint256 maltPurchased,
    uint256 startingPrice,
    uint256 endingPrice,
    uint256 finalPrice,
    uint256 pegPrice,
    uint256 startingTime,
    uint256 endingTime,
    uint256 finalBurnBudget,
    uint256 finalPurchased
  ) {
    AuctionData storage auction = idToAuction[currentAuctionId];

    return (
      currentAuctionId,
      auction.maxCommitments,
      auction.commitments,
      auction.maltPurchased,
      auction.startingPrice,
      auction.endingPrice,
      auction.finalPrice,
      auction.pegPrice,
      auction.startingTime,
      auction.endingTime,
      auction.finalBurnBudget,
      auction.finalPurchased
    );
  }

  function getAuction(uint256 _id) public view returns (
    uint256 fullRequirement,
    uint256 maxCommitments,
    uint256 commitments,
    uint256 startingPrice,
    uint256 endingPrice,
    uint256 finalPrice,
    uint256 pegPrice,
    uint256 startingTime,
    uint256 endingTime,
    uint256 finalBurnBudget,
    uint256 finalPurchased
  ) {
    AuctionData storage auction = idToAuction[_id];

    return (
      auction.fullRequirement,
      auction.maxCommitments,
      auction.commitments,
      auction.startingPrice,
      auction.endingPrice,
      auction.finalPrice,
      auction.pegPrice,
      auction.startingTime,
      auction.endingTime,
      auction.finalBurnBudget,
      auction.finalPurchased
    );
  }

  function getAuctionCore(uint256 _id) public view returns (
    uint256 auctionId,
    uint256 commitments,
    uint256 maltPurchased,
    uint256 startingPrice,
    uint256 finalPrice,
    uint256 pegPrice,
    uint256 startingTime,
    uint256 endingTime,
    uint256 preAuctionReserveRatio,
    bool active
  ) {
    AuctionData storage auction = idToAuction[_id];

    return (
      _id,
      auction.commitments,
      auction.maltPurchased,
      auction.startingPrice,
      auction.finalPrice,
      auction.pegPrice,
      auction.startingTime,
      auction.endingTime,
      auction.preAuctionReserveRatio,
      auction.active
    );
  }

  /*
   * INTERNAL FUNCTIONS
   */
  function _triggerAuction(
    uint256 pegPrice,
    uint256 rRatio,
    uint256 purchaseAmount
  ) internal {
    if (auctionStartController != address(0)) {
      bool success = IAuctionStartController(auctionStartController).checkForStart();
      if (!success) {
        return;
      }
    }
    (uint256 startingPrice, uint256 endingPrice) = _calculateAuctionPricing(rRatio);

    AuctionData memory auction = AuctionData(
      purchaseAmount, // fullRequirement
      purchaseAmount, // maxCommitments
      0, // commitments
      0, // maltPurchased
      startingPrice,
      endingPrice,
      0, // finalPrice
      pegPrice,
      now, // startingTime
      now.add(auctionLength), // endingTime
      true, // active
      rRatio, // preAuctionReserveRatio
      false, // finalized
      0, // claimableTokens
      0, // finalBurnBudget
      0 // finalPurchased
    );

    _createAuction(
      currentAuctionId,
      auction
    );
  }

  function _capCommitment(uint256 _id, uint256 _commitment) internal view returns (uint256 realCommitment) {
    AuctionData storage auction = idToAuction[_id];

    realCommitment = _commitment;

    if (auction.commitments.add(_commitment) >= auction.maxCommitments) {
      realCommitment = auction.maxCommitments.sub(auction.commitments);
    }
  }

  function _endAuction(uint256 _id) internal {
    AuctionData storage auction = idToAuction[_id];

    require(auction.active == true, "Auction is already over");

    auction.active = false;
    auction.finalPrice = currentPrice(_id);

    uint256 amountArbTokens = auction.commitments.mul(auction.pegPrice).div(auction.finalPrice);
    unclaimedArbTokens = unclaimedArbTokens.add(amountArbTokens);

    emit AuctionEnded(
      _id,
      auction.commitments,
      auction.startingPrice,
      auction.finalPrice,
      auction.maltPurchased
    );
  }

  function _finalizeAuction(uint256 auctionId) internal {
    (
      uint256 avgMaltPrice,
      uint256 commitments,
      uint256 fullRequirement,
      uint256 maltPurchased,
      uint256 finalPrice,
      uint256 preAuctionReserveRatio
    ) = _setupAuctionFinalization(auctionId);

    if (commitments >= fullRequirement) {
      return;
    }

    uint256 priceTarget = maltDataLab.priceTarget();

    // priceTarget.sub(preAuctionReserveRatio) represents maximum deficit per token
    // priceTarget divided by the max deficit is equivalent to 1 over the max deficit given we are in uint decimal
    // (commitments * 1/maxDeficit) - commitments
    uint256 maxBurnSpend = (commitments.mul(priceTarget).div(priceTarget.sub(preAuctionReserveRatio))).sub(commitments);

    uint256 totalTokens = commitments.mul(priceTarget).div(finalPrice);

    uint256 premiumExcess = 0;

    // The assumption here is that each token will be worth 1 Malt when redeemed.
    // Therefore if totalTokens is greater than the malt purchased then there is a net supply growth
    // After the tokens are repaid. We want this process to be neutral to supply at the very worst.
    if (totalTokens >= maltPurchased) {
      // This also assumes current purchase price of Malt is $1, which is higher than it will be in practice.
      // So the premium excess will actually ensure slight net negative supply growth.
      premiumExcess = totalTokens - maltPurchased;
    }

    uint256 realBurnBudget = auctionBurnReserveSkew.getRealBurnBudget(maxBurnSpend, premiumExcess);

    if (realBurnBudget > 0) {
      AuctionData storage auction = idToAuction[auctionId];

      auction.finalBurnBudget = realBurnBudget;
      auction.finalPurchased = liquidityExtension.purchaseAndBurn(realBurnBudget);
    }
  }

  function _setupAuctionFinalization(uint256 auctionId)
    internal
    returns (
      uint256 avgMaltPrice,
      uint256 commitments,
      uint256 fullRequirement,
      uint256 maltPurchased,
      uint256 finalPrice,
      uint256 preAuctionReserveRatio
    )
  {
    AuctionData storage auction = idToAuction[auctionId];
    require(auction.startingTime > 0, "No auction available for the given id");

    auction.finalized = true;

    if (auction.maltPurchased > 0) {
      avgMaltPrice = auction.commitments.mul(auction.pegPrice).div(auction.maltPurchased);
    }
    
    return (
      avgMaltPrice,
      auction.commitments,
      auction.fullRequirement,
      auction.maltPurchased,
      auction.finalPrice,
      auction.preAuctionReserveRatio
    );
  }

  function _createAuction(
    uint256 _id,
    AuctionData memory auction
  ) internal {
    require(auction.endingTime == uint256(uint64(auction.endingTime)));

    idToAuction[_id] = auction;

    emit AuctionStarted(
      _id,
      auction.maxCommitments,
      auction.startingPrice,
      auction.endingPrice,
      auction.startingTime,
      auction.endingTime
    );
  }

  function _calcRealMaxRaise(uint256 purchaseAmount, uint256 rRatio, uint256 decimals) internal pure returns (uint256) {
    uint256 realBurn = purchaseAmount.mul(
      Math.min(
        rRatio,
        10**decimals
      )
    ).div(10**decimals);

    return purchaseAmount.sub(realBurn);
  }

  function _calculateAuctionPricing(uint256 rRatio) internal view returns (
    uint256 startingPrice,
    uint256 endingPrice
  ) {
    startingPrice = maltDataLab.maltPriceAverage(priceLookback);

    if (startingPrice < rRatio) {
      startingPrice = rRatio;
    }

    // TODO use global intrinsic value instead of rRatio Fri 12 Nov 2021 11:51:28 GMT

    // rRatio should never be large enough for this to overflow
    uint256 absoluteBottom = rRatio * auctionEndReserveBps / 1000;

    uint256 priceTarget = maltDataLab.priceTarget();
    uint256 idealBottom = 1; // 1wei just to avoid any issues with it being 0

    // This should always be true
    if (priceTarget > rRatio) {
      idealBottom = priceTarget - rRatio;
    }

    assert(priceTarget >= startingPrice);
    assert(startingPrice > endingPrice);

    if (idealBottom < startingPrice) {
      endingPrice = idealBottom;
    } else {
      endingPrice = absoluteBottom;
    } 

    // priceTarget should never be large enough to overflow here
    uint256 maxPrice = priceTarget * maxAuctionEnd / 1000;

    if (endingPrice > maxPrice) {
      endingPrice = maxPrice;
    }
  }

  function _checkAuctionFinalization(bool isInternal) internal {
    if (isInternal && !isAuctionFinished(currentAuctionId)) {
      // Auction is still in progress after internal auction purchasing.
      _resetAuctionMaxCommitments();
    }

    if (isAuctionFinished(currentAuctionId)) {
      if (auctionActive(currentAuctionId)) {
        _endAuction(currentAuctionId);
      }

      if (!isAuctionFinalized(currentAuctionId)) {
        _finalizeAuction(currentAuctionId);
      }
      currentAuctionId = currentAuctionId + 1;
    }
  }

  function _resetAuctionMaxCommitments() internal {
    AuctionData storage auction = idToAuction[currentAuctionId];

    uint256 decimals = collateralToken.decimals();

    uint256 realMaxRaise = _calcRealMaxRaise(auction.fullRequirement, auction.preAuctionReserveRatio, decimals);

    if (auction.commitments <= realMaxRaise) {
      auction.maxCommitments = realMaxRaise;
    }
  }

  /*
   * PRIVILEDGED FUNCTIONS
   */
  function checkAuctionFinalization()
    external
    onlyRole(STABILIZER_NODE_ROLE, "Must be stabilizer node")
  {
    _checkAuctionFinalization(false);
  }

  function amendAccountParticipation(address account, uint256 auctionId, uint256 amount, uint256 maltPurchase)
    external
    onlyRole(AUCTION_AMENDER_ROLE, "Only auction amender")
  {
    AuctionData storage auction = idToAuction[auctionId];
    require(auction.accountCommitments[account].commitment >= amount, "amend: amount underflows");
    require(auction.accountCommitments[account].maltPurchased >= maltPurchase, "amend: maltPurchase underflows");

    auction.commitments = auction.commitments - amount;
    auction.maltPurchased = auction.maltPurchased - maltPurchase;

    auction.accountCommitments[account].commitment = auction.accountCommitments[account].commitment - amount; 
    auction.accountCommitments[account].maltPurchased = auction.accountCommitments[account].maltPurchased - maltPurchase;

    uint256 amountArbTokens = amount.mul(auction.pegPrice).div(auction.finalPrice);

    if (amountArbTokens > unclaimedArbTokens) {
      unclaimedArbTokens = 0;
    } else {
      unclaimedArbTokens = unclaimedArbTokens.sub(amountArbTokens);
    }
  }

  function allocateArbRewards(uint256 rewarded)
    external
    onlyRole(STABILIZER_NODE_ROLE, "Must be stabilizer node")
    returns (uint256)
  {
    AuctionData storage auction = idToAuction[replenishingAuctionId];

    if (auction.finalPrice == 0 || auction.startingTime == 0) {
      return rewarded;
    }

    if (auction.commitments == 0) {
      replenishingAuctionId = replenishingAuctionId + 1;
      return rewarded;
    }

    uint256 totalTokens = auction.commitments.mul(auction.pegPrice).div(auction.finalPrice);

    if (auction.claimableTokens < totalTokens) {
      uint256 requirement = totalTokens.sub(auction.claimableTokens);
      uint256 maxArbAllocation = rewarded.mul(arbTokenReplenishSplit).div(10000);

      if (requirement >= maxArbAllocation) {
        auction.claimableTokens = auction.claimableTokens.add(maxArbAllocation);
        rewarded = rewarded.sub(maxArbAllocation);
        claimableArbitrageRewards = claimableArbitrageRewards.add(maxArbAllocation);

        collateralToken.safeTransferFrom(stabilizerNode, address(this), maxArbAllocation);

        emit ArbTokenAllocation(
          replenishingAuctionId,
          maxArbAllocation
        );
      } else {
        auction.claimableTokens = auction.claimableTokens.add(requirement);
        rewarded = rewarded.sub(requirement);
        claimableArbitrageRewards = claimableArbitrageRewards.add(requirement);

        collateralToken.safeTransferFrom(stabilizerNode, address(this), requirement);

        emit ArbTokenAllocation(
          replenishingAuctionId,
          requirement
        );
      }

      if (auction.claimableTokens == totalTokens) {
        uint256 count = 1;

        while (true) {
          auction = idToAuction[replenishingAuctionId + count];

          if (auction.commitments > 0 || !auction.finalized) {
            replenishingAuctionId = replenishingAuctionId + count;
            break;
          }
          count += 1;
        }
      }
    }

    return rewarded;
  }

  function triggerAuction(uint256 pegPrice, uint256 purchaseAmount)
    external
    onlyRole(STABILIZER_NODE_ROLE, "Must be stabilizer node")
  {
    if (purchaseAmount == 0 || auctionExists(currentAuctionId)) {
      return;
    }

    uint256 rRatio = maltDataLab.reserveRatioAverage(reserveRatioLookback);

    _triggerAuction(pegPrice, rRatio, purchaseAmount);

    impliedCollateralService.handleDeficit(purchaseAmount);

    _checkAuctionFinalization(true);
  }

  function setAuctionLength(uint256 _length)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    require(_length > 0, "Length must be larger than 0");
    auctionLength = _length;
    emit SetAuctionLength(_length);
  }

  function setStabilizerNode(address _stabilizerNode)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    _swapRole(_stabilizerNode, stabilizerNode, STABILIZER_NODE_ROLE);
    stabilizerNode = _stabilizerNode;
    emit SetStabilizerNode(_stabilizerNode);
  }

  function setMaltDataLab(address _dataLab)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    maltDataLab = IMaltDataLab(_dataLab);
    emit SetMaltDataLab(_dataLab);
  }

  function setAuctionReplenishId(uint256 _id)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    replenishingAuctionId = _id;
  }

  function setDexHandler(address _handler)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    dexHandler = IDexHandler(_handler);
  }

  function setLiquidityExtension(address _liquidityExtension)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    liquidityExtension = ILiquidityExtension(_liquidityExtension);
  }

  function setImpliedCollateralService(address _impliedCollateralService)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    impliedCollateralService = IImpliedCollateralService(_impliedCollateralService);
  }

  function setAuctionBurnReserveSkew(address _reserveSkew)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    auctionBurnReserveSkew = IAuctionBurnReserveSkew(_reserveSkew);
  }

  function setAuctionAmender(address _amender)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    require(_amender != address(0), "Cannot set 0 address");
    _swapRole(_amender, amender, AUCTION_AMENDER_ROLE);
    amender = _amender;
  }

  function setAuctionStartController(address _controller)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    // This is allowed to be set to address(0) as its checked before calling methods on it
    auctionStartController = _controller;
  }

  function setTokenReplenishSplit(uint256 _split)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    require(_split > 0 && _split <= 10000, "Must be between 0-100%");
    arbTokenReplenishSplit = _split;
  }

  function setMaxAuctionEnd(uint256 _maxEnd)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    require(_maxEnd > 0 && _maxEnd <= 1000, "Must be between 0-100%");
    maxAuctionEnd = _maxEnd;
  }

  function setPriceLookback(uint256 _lookback)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    require(_lookback > 0, "Must be above 0");
    priceLookback = _lookback;
  }

  function setReserveRatioLookback(uint256 _lookback)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    require(_lookback > 0, "Must be above 0");
    reserveRatioLookback = _lookback;
  }

  function setAuctionEndReserveBps(uint256 _bps)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    require(_bps > 0 && _bps < 1000, "Must be between 0-100%");
    auctionEndReserveBps = _bps;
  }

  function setDustThreshold(uint256 _threshold)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    require(_threshold > 0, "Must be between greater than 0");
    dustThreshold = _threshold;
  }
}
