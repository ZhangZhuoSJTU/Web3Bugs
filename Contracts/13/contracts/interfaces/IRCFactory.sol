// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import "./IRealitio.sol";
import "./IRCTreasury.sol";
import "./IRCNftHubL2.sol";
import "./IRCOrderbook.sol";

interface IRCFactory {
    function nfthub() external returns (IRCNftHubL2);

    function treasury() external returns (IRCTreasury);

    function orderbook() external returns (IRCOrderbook);

    function getPotDistribution() external returns (uint256[5] memory);

    function minimumPriceIncreasePercent() external returns (uint256);

    function trapIfUnapproved() external returns (bool);

    function isMarketApproved(address) external returns (bool);

    function maxRentIterations() external returns (uint256);

    function setminimumPriceIncreasePercent(uint256 _percentIncrease) external;

    function setNFTMintingLimit(uint256 _mintLimit) external;

    function setMaxRentIterations(uint256 _rentLimit) external;

    function getOracleSettings()
        external
        view
        returns (
            IRealitio realitio,
            address arbitrator,
            uint32 timeout
        );

    function owner() external view returns (address);

    function isGovernor(address _user) external view returns (bool);
}
