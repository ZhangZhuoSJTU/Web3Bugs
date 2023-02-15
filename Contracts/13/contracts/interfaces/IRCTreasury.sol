// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRCTreasury {
    function setTokenAddress(address _newToken) external;

    function foreclosureTimeUser(
        address _user,
        uint256 _newBid,
        uint256 _timeOfNewBid
    ) external view returns (uint256);

    function refundUser(address _user, uint256 _refund) external;

    function bridgeAddress() external view returns (address);

    function factoryAddress() external view returns (address);

    function isMarket(address) external view returns (bool);

    function isForeclosed(address) external view returns (bool);

    function totalDeposits() external view returns (uint256);

    function marketPot(address) external view returns (uint256);

    function totalMarketPots() external view returns (uint256);

    function minRentalDayDivisor() external view returns (uint256);

    function maxContractBalance() external view returns (uint256);

    function globalPause() external view returns (bool);

    function marketPaused(address) external view returns (bool);

    function uberOwner() external view returns (address);

    function addMarket(address) external;

    function setMinRental(uint256 _newDivisor) external;

    function setMaxContractBalance(uint256) external;

    function setBridgeAddress(address _newAddress) external;

    function changeGlobalPause() external;

    function changePauseMarket(address _market) external;

    function setFactoryAddress(address _newFactory) external;

    function changeUberOwner(address _newUberOwner) external;

    function erc20() external returns (IERC20);

    function deposit(uint256 _amount, address _user) external returns (bool);

    function withdrawDeposit(uint256 _amount, bool _localWithdrawal) external;

    function payRent(uint256) external returns (bool);

    function payout(address, uint256) external returns (bool);

    function sponsor(address _sponsor, uint256 _amount) external returns (bool);

    function updateLastRentalTime(address) external returns (bool);

    function userTotalBids(address) external view returns (uint256);

    function checkSponsorship(address sender, uint256 _amount) external view;

    function updateRentalRate(
        address _oldOwner,
        address _newOwner,
        uint256 _oldPrice,
        uint256 _newPrice,
        uint256 _timeOwnershipChanged
    ) external;

    function increaseBidRate(address _user, uint256 _price) external;

    function decreaseBidRate(address _user, uint256 _price) external;

    function resetUser(address _user) external;

    function collectRentUser(address _user, uint256 _timeToCollectTo)
        external
        returns (uint256 newTimeLastCollectedOnForeclosure);

    function userDeposit(address) external view returns (uint256);

    function topupMarketBalance(uint256 _amount) external;

    function toggleWhitelist() external;

    function addToWhitelist(address _user) external;

    function batchAddToWhitelist(address[] calldata _users) external;
}
