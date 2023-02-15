pragma solidity >=0.6.6;

interface IAuction {
  function replenishingAuctionId() external view returns(uint256);
  function currentAuctionId() external view returns(uint256);
  function purchaseArbitrageTokens(uint256 amount) external;
  function claimArbitrage(uint256 _auctionId) external;
  function isAuctionFinished(uint256 _id) external view returns(bool);
  function auctionActive(uint256 _id) external view returns (bool);
  function isAuctionFinalized(uint256 _id) external view returns (bool);
  function userClaimableArbTokens(
    address account,
    uint256 auctionId
  ) external view returns (uint256);
  function balanceOfArbTokens(
    uint256 _auctionId,
    address account
  ) external view returns (uint256);
  function averageMaltPrice(uint256 _id) external view returns (uint256);
  function currentPrice(uint256 _id) external view returns (uint256);
  function getAuctionCommitments(uint256 _id) external view returns (uint256 commitments, uint256 maxCommitments);
  function getAuctionPrices(uint256 _id) external view returns (uint256 startingPrice, uint256 endingPrice, uint256 finalPrice);
  function auctionExists(uint256 _id) external view returns (bool);
  function getAccountCommitments(address account) external view returns (
    uint256[] memory auctions,
    uint256[] memory commitments,
    uint256[] memory awardedTokens,
    uint256[] memory redeemedTokens,
    uint256[] memory finalPrice,
    uint256[] memory claimable,
    bool[] memory finished
  );
  function getAccountCommitmentAuctions(address account) external view returns (uint[] memory);
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
  );
  function getAuction(uint256 _id) external view returns (
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
  );
  function getAuctionCore(uint256 _id) external view returns (
    uint256 auctionId,
    uint256 commitments,
    uint256 maltPurchased,
    uint256 startingPrice,
    uint256 finalPrice,
    uint256 pegPrice,
    uint256 startingTime,
    uint256 endingTime,
    bool active
  );
  function checkAuctionFinalization() external;
  function allocateArbRewards(uint256 rewarded) external returns (uint256);
  function triggerAuction(uint256 pegPrice, uint256 purchaseAmount) external;
  function getAuctionParticipationForAccount(address account, uint256 auctionId) external view returns(uint256, uint256, uint256);
  function amendAccountParticipation(address account, uint256 auctionId, uint256 amount, uint256 maltQuantity) external;
}
