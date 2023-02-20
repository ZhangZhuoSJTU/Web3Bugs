// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

interface IPriceFeed {

    // --- Events ---
    event LastGoodPriceUpdated(uint _lastGoodPrice);

    // --- Function ---
    // function fetchPrice() external returns (uint);

    function fetchPrice_v() view external returns (uint);
}
