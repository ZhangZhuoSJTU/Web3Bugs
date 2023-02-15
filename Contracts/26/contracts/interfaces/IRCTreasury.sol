// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IRCOrderbook.sol";
import "./IRCLeaderboard.sol";
import "./IRCFactory.sol";

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
