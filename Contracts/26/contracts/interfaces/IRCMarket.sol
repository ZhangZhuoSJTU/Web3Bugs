// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.7;

import "./IRCNftHubL2.sol";
import "./IRCTreasury.sol";
import "./IRCFactory.sol";
import "./IRCLeaderboard.sol";
import "./IRealitio.sol";
import "./IRCOrderbook.sol";

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
