// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8;

interface IEtherRocks {
    function getRockInfo(uint256 rockNumber)
        external
        view
        returns (
            address,
            bool,
            uint256,
            uint256
        );

    function giftRock(uint256 rockNumber, address receiver) external;

    function dontSellRock(uint256 rockNumber) external;
}
