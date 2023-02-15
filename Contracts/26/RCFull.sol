// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.7;

// Just a handy file to copy/paste into remix

interface IRCFactory {
    function createMarket(
        uint32 _mode,
        string memory _ipfsHash,
        string memory _slug,
        uint32[] memory _timestamps,
        string[] memory _tokenURIs,
        address _artistAddress,
        address _affiliateAddress,
        address[] memory _cardAffiliateAddresses,
        string calldata _realitioQuestion,
        uint256 _sponsorship
    ) external returns (address);

    function mintCopyOfNFT(address _user, uint256 _tokenId) external;

    // view functions

    function nfthub() external view returns (address);

    function ipfsHash(address) external view returns (string memory);

    function slugToAddress(string memory) external view returns (address);

    function addressToSlug(address) external view returns (string memory);

    function marketInfoResults() external view returns (uint256);

    function treasury() external view returns (address);

    function orderbook() external view returns (address);

    function leaderboard() external view returns (address);

    function realitio() external view returns (address);

    function getAllMarkets(IRCMarket.Mode _mode)
        external
        view
        returns (address[] memory);

    function getMostRecentMarket(IRCMarket.Mode _mode)
        external
        view
        returns (address);

    function referenceContractAddress() external view returns (address);

    function referenceContractVersion() external view returns (uint256);

    function sponsorshipRequired() external view returns (uint256);

    function advancedWarning() external view returns (uint32);

    function maximumDuration() external view returns (uint32);

    function minimumDuration() external view returns (uint32);

    function marketCreationGovernorsOnly() external view returns (bool);

    function approvedAffiliatesOnly() external view returns (bool);

    function approvedArtistsOnly() external view returns (bool);

    function arbitrator() external view returns (address);

    function timeout() external view returns (uint32);

    function cardLimit() external view returns (uint256);

    function getPotDistribution() external view returns (uint256[5] memory);

    function minimumPriceIncreasePercent() external view returns (uint256);

    function nftsToAward() external view returns (uint256);

    function isMarketApproved(address) external view returns (bool);

    function marketPausedDefaultState() external view returns (bool);

    function mintMarketNFT(uint256 _card) external;

    function getOracleSettings()
        external
        view
        returns (
            IRealitio oracle,
            address arbitratorAddress,
            uint32 _timeout
        );

    // only Governors
    function changeMarketApproval(address _market) external;

    function addArtist(address _newArtist) external;

    function removeArtist(address _oldArtist) external;

    function addAffiliate(address _newAffiliate) external;

    function removeAffiliate(address _oldAffiliate) external;

    // only Owner
    function setMarketPausedDefaultState(bool _state) external;

    function setTimeout(uint32 _newTimeout) external;

    function setMaxRentIterations(uint256 _rentLimit, uint256 _rentLimitLocking)
        external;

    function setArbitrator(address _newAddress) external;

    function setRealitioAddress(address _newAddress) external;

    function maxRentIterations() external view returns (uint256);

    function maxRentIterationsToLockMarket() external view returns (uint256);

    function setCardLimit(uint256 _cardLimit) external;

    function setMinimumPriceIncreasePercent(uint256 _percentIncrease) external;

    function setNumberOfNFTsToAward(uint256 _NFTsToAward) external;

    function updateTokenURI(
        address _market,
        uint256 _cardId,
        string calldata _newTokenURI,
        string calldata _newCopyTokenURI
    ) external;

    function setPotDistribution(
        uint256 _artistCut,
        uint256 _winnerCut,
        uint256 _creatorCut,
        uint256 _affiliateCut,
        uint256 _cardAffiliateCut
    ) external;

    function changeMarketCreationGovernorsOnly() external;

    function changeApprovedArtistsOnly() external;

    function changeApprovedAffilliatesOnly() external;

    function setSponsorshipRequired(uint256 _amount) external;

    function setMarketTimeRestrictions(
        uint32 _newAdvancedWarning,
        uint32 _newMinimumDuration,
        uint32 _newMaximumDuration
    ) external;

    function setMarketInfoResults(uint256 _results) external;

    // only UberOwner
    function setReferenceContractAddress(address _newAddress) external;

    function setOrderbookAddress(IRCOrderbook _newAddress) external;

    function setLeaderboardAddress(IRCLeaderboard _newAddress) external;

    function setNftHubAddress(IRCNftHubL2 _newAddress) external;
}

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRCTreasury {
    function setTokenAddress(address _newToken) external;

    function grantRole(string memory role, address account) external;

    function grantRole(bytes32, address) external;

    function revokeRole(string memory role, address account) external;

    function revokeRole(bytes32, address) external;

    function collectRentUser(address _user, uint256 _timeToCollectTo)
        external
        returns (uint256 newTimeLastCollectedOnForeclosure);

    function topupMarketBalance(uint256 _amount) external;

    function assessForeclosure(address _user) external;

    // view functions
    function foreclosureTimeUser(
        address _user,
        uint256 _newBid,
        uint256 _timeOfNewBid
    ) external view returns (uint256);

    function bridgeAddress() external view returns (address);

    function checkPermission(bytes32, address) external view returns (bool);

    function erc20() external view returns (IERC20);

    function factory() external view returns (IRCFactory);

    function orderbook() external view returns (IRCOrderbook);

    function leaderboard() external view returns (IRCLeaderboard);

    function isForeclosed(address) external view returns (bool);

    function userTotalBids(address) external view returns (uint256);

    function userDeposit(address) external view returns (uint256);

    function totalDeposits() external view returns (uint256);

    function marketPot(address) external view returns (uint256);

    function totalMarketPots() external view returns (uint256);

    function marketBalance() external view returns (uint256);

    function marketBalanceTopup() external view returns (uint256);

    function minRentalDayDivisor() external view returns (uint256);

    function maxContractBalance() external view returns (uint256);

    function globalPause() external view returns (bool);

    function addMarket(address _market, bool paused) external;

    function marketPaused(address) external view returns (bool);

    function batchWhitelist(address[] calldata _users, bool add) external;

    function marketWhitelistCheck(address _user) external returns (bool);

    function lockMarketPaused(address _market) external view returns (bool);

    function setBridgeAddress(address _newAddress) external;

    function setOrderbookAddress(address _newAddress) external;

    function setLeaderboardAddress(address _newAddress) external;

    function setFactoryAddress(address _newFactory) external;

    function deposit(uint256 _amount, address _user) external returns (bool);

    function withdrawDeposit(uint256 _amount, bool _localWithdrawal) external;

    function checkSponsorship(address sender, uint256 _amount) external view;

    //only orderbook
    function increaseBidRate(address _user, uint256 _price) external;

    function decreaseBidRate(address _user, uint256 _price) external;

    function updateRentalRate(
        address _oldOwner,
        address _newOwner,
        uint256 _oldPrice,
        uint256 _newPrice,
        uint256 _timeOwnershipChanged
    ) external;

    // only owner
    function setMinRental(uint256 _newDivisor) external;

    function setMaxContractBalance(uint256) external;

    function changeGlobalPause() external;

    function changePauseMarket(address _market, bool _paused) external;

    function toggleWhitelist() external;

    // only factory
    function unPauseMarket(address _market) external;

    // only markets
    function payRent(uint256) external returns (uint256);

    function payout(address, uint256) external returns (bool);

    function refundUser(address _user, uint256 _refund) external;

    function sponsor(address _sponsor, uint256 _amount) external;

    function updateLastRentalTime(address) external;
}

interface IRCMarket {
    enum States {
        CLOSED,
        OPEN,
        LOCKED,
        WITHDRAW
    }
    enum Mode {
        CLASSIC,
        WINNER_TAKES_ALL,
        SAFE_MODE
    }

    function getWinnerFromOracle() external;

    function setAmicableResolution(uint256 _winningOutcome) external;

    function lockMarket() external;

    function claimCard(uint256 _card) external;

    function rentAllCards(uint256 _maxSumOfPrices) external;

    function newRental(
        uint256 _newPrice,
        uint256 _timeHeldLimit,
        address _startingPosition,
        uint256 _card
    ) external;

    function updateTimeHeldLimit(uint256 _timeHeldLimit, uint256 _card)
        external;

    function collectRent(uint256 _cardId) external returns (bool);

    function exitAll() external;

    function exit(uint256) external;

    function sponsor(address _sponsor, uint256 _amount) external;

    function sponsor(uint256 _amount) external;

    function circuitBreaker() external;

    // payouts
    function withdraw() external;

    function payArtist() external;

    function payMarketCreator() external;

    function payAffiliate() external;

    function payCardAffiliate(uint256) external;

    // view functions
    function nfthub() external view returns (IRCNftHubL2);

    function treasury() external view returns (IRCTreasury);

    function factory() external view returns (IRCFactory);

    function leaderboard() external view returns (IRCLeaderboard);

    function orderbook() external view returns (IRCOrderbook);

    function realitio() external view returns (IRealitio);

    function mode() external view returns (Mode);

    function isMarket() external view returns (bool);

    function numberOfCards() external view returns (uint256);

    function nftsToAward() external view returns (uint256);

    function ownerOf(uint256 tokenId) external view returns (address);

    function state() external view returns (States);

    function getTokenId(uint256 _card) external view returns (uint256 _tokenId);

    function cardAccountingIndex() external view returns (uint256);

    function accountingComplete() external view returns (bool);

    // prices, deposits, rent

    function rentCollectedPerUser(address) external view returns (uint256);

    function rentCollectedPerUserPerCard(address, uint256)
        external
        view
        returns (uint256);

    function totalRentCollected() external view returns (uint256);

    function exitedTimestamp(address) external view returns (uint256);

    //parameters

    function minimumPriceIncreasePercent() external view returns (uint256);

    function minRentalDayDivisor() external view returns (uint256);

    function maxRentIterations() external view returns (uint256);

    // time
    function timeHeld(uint256 _card, address _user)
        external
        view
        returns (uint256);

    function timeLastCollected(uint256 _card) external view returns (uint256);

    function longestOwner(uint256 _card) external view returns (address);

    function marketOpeningTime() external view returns (uint32);

    function marketLockingTime() external view returns (uint32);

    function oracleResolutionTime() external view returns (uint32);

    // payout settings
    function winningOutcome() external view returns (uint256);

    function userAlreadyWithdrawn(address) external view returns (bool);

    function artistAddress() external view returns (address);

    function artistCut() external view returns (uint256);

    function artistPaid() external view returns (bool);

    function affiliateAddress() external view returns (address);

    function affiliateCut() external view returns (uint256);

    function affiliatePaid() external view returns (bool);

    function winnerCut() external view returns (uint256);

    function marketCreatorAddress() external view returns (address);

    function creatorCut() external view returns (uint256);

    function creatorPaid() external view returns (bool);

    function cardAffiliateAddresses(uint256) external view returns (address);

    function cardAffiliateCut() external view returns (uint256);

    // oracle

    function questionId() external view returns (bytes32);

    function arbitrator() external view returns (address);

    function timeout() external view returns (uint32);

    function isFinalized() external view returns (bool);

    // setup
    function initialize(
        Mode _mode,
        uint32[] calldata _timestamps,
        uint256 _numberOfCards,
        address _artistAddress,
        address _affiliateAddress,
        address[] calldata _cardAffiliateAddresses,
        address _marketCreatorAddress,
        string calldata _realitioQuestion,
        uint256 _nftsToAward
    ) external;

    function transferCard(
        address _oldOwner,
        address _newOwner,
        uint256 _token,
        uint256 _price,
        uint256 _timeLimit
    ) external;
}

interface IRCOrderbook {
    struct Bid {
        address market;
        address next;
        address prev;
        uint64 card;
        uint128 price;
        uint64 timeHeldLimit;
    }

    function index(
        address _market,
        address _user,
        uint256 _token
    ) external view returns (uint256);

    function ownerOf(address, uint256) external view returns (address);

    function closedMarkets(uint256) external view returns (address);

    function userClosedMarketIndex(address) external view returns (uint256);

    function treasury() external view returns (IRCTreasury);

    function maxSearchIterations() external view returns (uint256);

    function maxDeletions() external view returns (uint256);

    function cleaningLoops() external view returns (uint256);

    function marketCloseLimit() external view returns (uint256);

    function nonce() external view returns (uint256);

    function cleanWastePile() external;

    function getBid(
        address _market,
        address _user,
        uint256 _card
    ) external view returns (Bid memory);

    function setTreasuryAddress(address _newTreasury) external;

    function addBidToOrderbook(
        address _user,
        uint256 _token,
        uint256 _price,
        uint256 _timeHeldLimit,
        address _prevUserAddress
    ) external;

    function removeBidFromOrderbook(address _user, uint256 _token) external;

    function closeMarket() external returns (bool);

    function findNewOwner(uint256 _token, uint256 _timeOwnershipChanged)
        external;

    function getBidValue(address _user, uint256 _token)
        external
        view
        returns (uint256);

    function getTimeHeldlimit(address _user, uint256 _token)
        external
        returns (uint256);

    function bidExists(
        address _user,
        address _market,
        uint256 _card
    ) external view returns (bool);

    function setTimeHeldlimit(
        address _user,
        uint256 _token,
        uint256 _timeHeldLimit
    ) external;

    function removeUserFromOrderbook(address _user) external;

    function removeOldBids(address _user) external;

    function reduceTimeHeldLimit(
        address _user,
        uint256 _token,
        uint256 _timeToReduce
    ) external;

    function setDeletionLimit(uint256 _deletionLimit) external;

    function setCleaningLimit(uint256 _cleaningLimit) external;

    function setSearchLimit(uint256 _searchLimit) external;

    function setMarketCloseLimit(uint256 _marketCloseLimit) external;
}

interface IRCLeaderboard {
    function treasury() external view returns (IRCTreasury);

    function market() external view returns (IRCMarket);

    function NFTsToAward(address _market) external view returns (uint256);

    function updateLeaderboard(
        address _user,
        uint256 _card,
        uint256 _timeHeld
    ) external;

    function claimNFT(address _user, uint256 _card) external;
}

interface IRealitio {
    function askQuestion(
        uint256 template_id,
        string calldata question,
        address arbitrator,
        uint32 timeout,
        uint32 opening_ts,
        uint256 nonce
    ) external payable returns (bytes32);

    function resultFor(bytes32 question_id) external view returns (bytes32);

    function isFinalized(bytes32 question_id) external view returns (bool);

    function getContentHash(bytes32 question_id)
        external
        view
        returns (bytes32);
}

interface IRCNftHubL2 {
    function marketTracker(uint256) external view returns (address);

    function ownerOf(uint256) external view returns (address);

    function tokenURI(uint256) external view returns (string memory);

    function addMarket(address) external;

    function totalSupply() external view returns (uint256 nftCount);

    function mint(
        address,
        uint256,
        string calldata
    ) external;

    function transferNft(
        address,
        address,
        uint256
    ) external;

    function deposit(address user, bytes calldata depositData) external;

    function withdraw(uint256 tokenId) external;

    function withdrawWithMetadata(uint256 tokenId) external;
}
