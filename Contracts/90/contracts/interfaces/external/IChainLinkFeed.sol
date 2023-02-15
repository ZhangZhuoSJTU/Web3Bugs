// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

interface IChainLinkFeed {
    function latestAnswer() external view returns (int);
}
