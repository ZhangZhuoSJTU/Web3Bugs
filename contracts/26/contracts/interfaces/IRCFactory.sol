// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.7;

import "./IRealitio.sol";
import "./IRCTreasury.sol";
import "./IRCMarket.sol";
import "./IRCNftHubL2.sol";
import "./IRCOrderbook.sol";
import "./IRCLeaderboard.sol";

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

    function nfthub() external view returns (IRCNftHubL2);

    function ipfsHash(address) external view returns (string memory);

    function slugToAddress(string memory) external view returns (address);

    function addressToSlug(address) external view returns (string memory);

    function marketInfoResults() external view returns (uint256);

    function treasury() external view returns (IRCTreasury);

    function orderbook() external view returns (IRCOrderbook);

    function leaderboard() external view returns (IRCLeaderboard);

    function realitio() external view returns (IRealitio);

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
