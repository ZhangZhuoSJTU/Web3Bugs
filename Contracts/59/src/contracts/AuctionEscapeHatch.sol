pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/Math.sol";

import "./Permissions.sol";
import "./interfaces/IAuction.sol";
import "./interfaces/IDexHandler.sol";
import "./interfaces/IBurnMintableERC20.sol";
import "./Auction.sol";


struct EarlyExitData {
  uint256 exitedEarly;
  uint256 earlyExitReturn;
  uint256 maltUsed;
}

struct AuctionExits {
  uint256 exitedEarly;
  uint256 earlyExitReturn;
  uint256 maltUsed;
  mapping(address => EarlyExitData) accountExits;
}


/// @title Auction Escape Hatch
/// @author 0xScotch <scotch@malt.money>
/// @notice Functionality to reduce risk profile of holding arbitrage tokens by allowing early exit
contract AuctionEscapeHatch is Initializable, Permissions {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  IAuction public auction;
  IDexHandler public dexHandler;
  ERC20 public collateralToken;
  IBurnMintableERC20 public malt;
  uint256 public maxEarlyExitBps = 200; // 20%
  uint256 public cooloffPeriod = 60 * 60 * 24; // 24 hours

  mapping(uint256 => AuctionExits) internal auctionEarlyExits;

  event EarlyExit(address account, uint256 amount, uint256 received);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _collateralToken,
    address _malt,
    address _auction,
    address _handler
  ) external initializer {
    _adminSetup(_timelock);
    _setupRole(ADMIN_ROLE, initialAdmin);

    collateralToken = ERC20(_collateralToken);
    malt = IBurnMintableERC20(_malt);
    auction = IAuction(_auction);
    dexHandler = IDexHandler(_handler);
  }

  function exitEarly(uint256 _auctionId, uint256 amount, uint256 minOut) external notSameBlock {
    uint256 maltQuantity = _calculateMaltRequiredForExit(_auctionId, amount);

    // TODO ensure this contract is added as a mint requester Sat 06 Nov 2021 20:13:49 GMT
    malt.mint(address(dexHandler), maltQuantity);
    uint256 amountOut = dexHandler.sellMalt();

    require(amountOut > minOut, "EarlyExit: Insufficient output");

    AuctionExits storage auctionExits = auctionEarlyExits[_auctionId];

    auctionExits.exitedEarly = auctionExits.exitedEarly + amount;
    auctionExits.earlyExitReturn = auctionExits.earlyExitReturn + amountOut;
    auctionExits.maltUsed = auctionExits.maltUsed + maltQuantity;
    auctionExits.accountExits[msg.sender].exitedEarly = auctionExits.accountExits[msg.sender].exitedEarly + amount; 
    auctionExits.accountExits[msg.sender].earlyExitReturn = auctionExits.accountExits[msg.sender].earlyExitReturn + amountOut; 
    auctionExits.accountExits[msg.sender].maltUsed = auctionExits.accountExits[msg.sender].maltUsed + maltQuantity; 

    auction.amendAccountParticipation(
      msg.sender,
      _auctionId,
      amount,
      maltQuantity
    );

    collateralToken.safeTransfer(msg.sender, amountOut);
    emit EarlyExit(msg.sender, amount, amountOut);
  }

  function earlyExitReturn(address account, uint256 _auctionId, uint256 amount) public view returns(uint256) {
    // We don't need all the values
    (,,,,,
     uint256 pegPrice,
     ,
     uint256 auctionEndTime,
     bool active
    ) = auction.getAuctionCore(_auctionId);

    if(active || block.timestamp < auctionEndTime) {
      return 0;
    }

    (
      uint256 userCommitment,
      uint256 userRedeemed,
      uint256 userMaltPurchased
    ) = auction.getAuctionParticipationForAccount(account, _auctionId);

    // This should never overflow due to guards in redemption code
    uint256 userOutstanding = userCommitment - userRedeemed;

    if (amount > userOutstanding) {
      amount = userOutstanding;
    }

    if (amount == 0) {
      return 0;
    }

    (uint256 currentPrice,) = dexHandler.maltMarketPrice();

    uint256 maltQuantity = userMaltPurchased.mul(amount).div(userCommitment);

    uint256 fullReturn = maltQuantity.mul(currentPrice) / pegPrice;

    // setCooloffPeriod guards against cooloffPeriod ever being 0
    uint256 progressionBps = (block.timestamp - auctionEndTime) * 10000 / cooloffPeriod;
    if (progressionBps > 10000) {
      progressionBps = 10000;
    }

    if (fullReturn > amount) {
      // Allow a % of profit to be realised
      uint256 maxProfit = (fullReturn - amount) * (maxEarlyExitBps * progressionBps / 10000) / 1000;
      return amount + maxProfit;
    } 

    return fullReturn;
  }

  function accountAuctionExits(address account, uint256 auctionId) external view returns (
    uint256 exitedEarly,
    uint256 earlyExitReturn,
    uint256 maltUsed
  ) {
    EarlyExitData storage accountExits = auctionEarlyExits[auctionId].accountExits[account];

    return (accountExits.exitedEarly, accountExits.earlyExitReturn, accountExits.maltUsed);
  }

  function globalAuctionExits(uint256 auctionId) external view returns (
    uint256 exitedEarly,
    uint256 earlyExitReturn,
    uint256 maltUsed
  ) {
    AuctionExits storage auctionExits = auctionEarlyExits[auctionId];

    return (auctionExits.exitedEarly, auctionExits.earlyExitReturn, auctionExits.maltUsed);
  }

  /*
   * INTERNAL METHODS
   */
  function _calculateMaltRequiredForExit(uint256 _auctionId, uint256 amount) internal returns(uint256) {
    // We don't need all the values
    (,,,,,
     uint256 pegPrice,
     ,
     uint256 auctionEndTime,
     bool active
    ) = auction.getAuctionCore(_auctionId);

    require(!active, "Cannot exit early on an active auction");
    require(block.timestamp > auctionEndTime, "Auction not over");

    (
      uint256 userCommitment,
      uint256 userRedeemed,
      uint256 userMaltPurchased
    ) = auction.getAuctionParticipationForAccount(msg.sender, _auctionId);

    // This should never overflow due to guards in redemption code
    if (amount > (userCommitment - userRedeemed)) {
      amount = userCommitment - userRedeemed;
    }

    require(amount > 0, "Nothing to claim");

    (uint256 currentPrice,) = dexHandler.maltMarketPrice();

    uint256 maltQuantity = userMaltPurchased.mul(amount).div(userCommitment);

    uint256 fullReturn = maltQuantity.mul(currentPrice) / pegPrice;

    // setCooloffPeriod guards against cooloffPeriod ever being 0
    uint256 progressionBps = (block.timestamp - auctionEndTime) * 10000 / cooloffPeriod;
    if (progressionBps > 10000) {
      progressionBps = 10000;
    }

    if (fullReturn > amount) {
      // Allow a % of profit to be realised
      uint256 maxProfit = (fullReturn - amount) * (maxEarlyExitBps * progressionBps / 10000) / 1000;
      uint256 desiredReturn = amount + maxProfit;
      maltQuantity = desiredReturn.mul(pegPrice) / currentPrice;
    } 

    return maltQuantity;
  }

  /*
   * PRIVILEDGED METHODS
   */
  function setEarlyExitBps(uint256 _earlyExitBps)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    require(_earlyExitBps > 0 && _earlyExitBps <= 1000, "Must be between 0-100%");
    maxEarlyExitBps = _earlyExitBps;
  }

  function setCooloffPeriod(uint256 _period)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    require(_period > 0, "Cannot have 0 lookback period");
    cooloffPeriod = _period;
  }

  function setDexHandler(address _handler)
    external
    onlyRole(ADMIN_ROLE, "Must have admin privilege")
  {
    dexHandler = IDexHandler(_handler);
  }
}
