pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./Permissions.sol";
import "./interfaces/IAuction.sol";


/// @title Auction Participant
/// @author 0xScotch <scotch@malt.money>
/// @notice Will generally be inherited to give another contract the ability to use its capital to buy arbitrage tokens
contract AuctionParticipant is Permissions {
  bytes32 public constant IMPLIED_COLLATERAL_SERVICE_ROLE = keccak256("IMPLIED_COLLATERAL_SERVICE_ROLE");

  IAuction public auction;
  ERC20 public auctionRewardToken;

  uint256 public replenishingIndex;
  uint256[] public auctionIds;
  uint256 public claimableRewards;

  bool internal setupCompleted;

  function setupParticipant(
    address _impliedCollateralService,
    address _rewardToken,
    address _auction
  ) public {
    require(!setupCompleted, "Can only call setup once");

    _roleSetup(IMPLIED_COLLATERAL_SERVICE_ROLE, _impliedCollateralService);
    auctionRewardToken = ERC20(_rewardToken);
    auction = IAuction(_auction);

    setupCompleted = true;
  }

  function purchaseArbitrageTokens(uint256 maxAmount)
    external
    onlyRole(IMPLIED_COLLATERAL_SERVICE_ROLE, "Must have implied collateral service privs")
    returns (uint256 remaining)
  {
    uint256 balance = usableBalance();

    if (maxAmount < balance) {
      balance = maxAmount;
    }

    uint256 currentAuction = auction.currentAuctionId();
    
    if (!auction.auctionActive(currentAuction)) {
      return maxAmount;
    }

    auctionIds.push(currentAuction);

    auctionRewardToken.approve(address(auction), balance);
    auction.purchaseArbitrageTokens(balance);
    
    return maxAmount - balance;
  }

  function claim() external {
    if (auctionIds.length == 0 || replenishingIndex >= auctionIds.length) {
      return;
    }

    uint256 auctionId = auctionIds[replenishingIndex];
    uint256 replenishingId = auction.replenishingAuctionId();

    if (auctionId > replenishingId) {
      // Not yet replenishing this auction
      return;
    }
    uint256 claimableTokens = auction.userClaimableArbTokens(address(this), auctionId);

    if (claimableTokens == 0) {
      // Nothing to claim yet
      return;
    }

    uint256 balance = auctionRewardToken.balanceOf(address(this));

    auction.claimArbitrage(auctionId);

    uint256 finalBalance = auctionRewardToken.balanceOf(address(this));
    uint256 rewardedAmount = finalBalance - balance;

    claimableRewards = claimableRewards.add(rewardedAmount);

    uint256 claimable = auction.userClaimableArbTokens(address(this), auctionId);

    if (replenishingId > auctionId && claimable == 0) {
      // Don't increment replenishingIndex if replenishingAuctionId == auctionId as
      // claimable could be 0 due to the debt not being 100% replenished.
      replenishingIndex = replenishingIndex + 1;
    }

    _handleRewardDistribution(rewardedAmount);
  }

  function outstandingArbTokens() public view returns (uint256 outstanding) {
    outstanding = 0;

    for (uint256 i = replenishingIndex; i < auctionIds.length; i = i + 1) {
      uint256 claimable = auction.balanceOfArbTokens(
        auctionIds[i],
        address(this)
      );

      outstanding = outstanding + claimable;
    }

    return outstanding;
  }

  function getAllAuctionIds() public view returns (uint256[] memory) {
    return auctionIds;
  }

  function usableBalance() virtual public view returns(uint256) {
    return auctionRewardToken.balanceOf(address(this));
  }

  function _handleRewardDistribution(uint256 rewarded) virtual internal {
    // Do nothing
    return;
  }

  function setReplenishingIndex(uint256 _index)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_index > replenishingIndex, "Cannot replenishingIndex to old value");
    replenishingIndex = _index;
  }
}
