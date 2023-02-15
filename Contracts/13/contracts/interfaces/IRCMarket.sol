// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import "../interfaces/IRealitio.sol";

interface IRCMarket {
    enum States {CLOSED, OPEN, LOCKED, WITHDRAW}

    function isMarket() external view returns (bool);

    function sponsor(address _sponsor, uint256 _amount) external;

    function sponsor(uint256 _amount) external;

    function initialize(
        uint256 _mode,
        uint32[] calldata _timestamps,
        uint256 _numberOfTokens,
        uint256 _totalNftMintCount,
        address _artistAddress,
        address _affiliateAddress,
        address[] calldata _cardAffiliateAddresses,
        address _marketCreatorAddress,
        string calldata _realitioQuestion
    ) external;

    function tokenURI(uint256) external view returns (string memory);

    function ownerOf(uint256 tokenId) external view returns (address);

    function state() external view returns (States);

    function collectRentAllCards() external returns (bool);

    function exitAll() external;

    function exit(uint256) external;

    function marketLockingTime() external returns (uint32);

    function transferCard(
        address _oldOwner,
        address _newOwner,
        uint256 _token,
        uint256 _price,
        uint256 _timeLimit
    ) external;
}
