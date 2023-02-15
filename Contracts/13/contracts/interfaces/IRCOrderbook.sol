// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

interface IRCOrderbook {
    function changeUberOwner(address) external;

    function setFactoryAddress(address) external;

    function addMarket(
        address _market,
        uint256 _tokenCount,
        uint256 _minIncrease
    ) external;

    function setLimits(
        uint256 _deletionLimit,
        uint256 _cleaningLimit,
        uint256 _searchLimit
    ) external;

    function addBidToOrderbook(
        address _user,
        uint256 _token,
        uint256 _price,
        uint256 _timeHeldLimit,
        address _prevUserAddress
    ) external;

    function removeBidFromOrderbook(address _user, uint256 _token) external;

    function closeMarket() external;

    function findNewOwner(uint256 _token, uint256 _timeOwnershipChanged)
        external
        returns (address _newOwner);

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
        uint256 _token
    ) external view returns (bool);

    function setTimeHeldlimit(
        address _user,
        uint256 _token,
        uint256 _timeHeldLimit
    ) external;

    function removeUserFromOrderbook(address _user)
        external
        returns (bool _userForeclosed);

    function removeOldBids(address _user) external;

    function reduceTimeHeldLimit(
        address _user,
        uint256 _token,
        uint256 _timeToReduce
    ) external;
}
