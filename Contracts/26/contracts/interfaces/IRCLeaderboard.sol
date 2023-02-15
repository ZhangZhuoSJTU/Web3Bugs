// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.7;

import "./IRCTreasury.sol";
import "./IRCMarket.sol";

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
