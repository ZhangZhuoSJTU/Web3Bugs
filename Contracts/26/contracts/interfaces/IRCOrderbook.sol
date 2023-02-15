// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.7;

import "./IRCTreasury.sol";

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
