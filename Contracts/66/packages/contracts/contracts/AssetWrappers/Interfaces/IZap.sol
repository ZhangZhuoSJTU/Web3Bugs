// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;


// Trader Joe's Zap Contract
interface IZap {
    // convert from one asset to another
    // or from one asset to an LP token
    function zapInToken(
        address _from,
        uint256 amount,
        address _to
    ) external;

    // send in AVAX and convert to LP token
    function zapIn(address _to) external payable;

    // send in amount of _from tokens and receive AVAX
    function zapOut(address _from, uint256 amount) external;
}