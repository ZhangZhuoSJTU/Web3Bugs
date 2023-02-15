//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../lib/LibBalances.sol";

contract LibBalancesMock {
    function notionalValue(Balances.Position calldata position, uint256 price) external pure returns (uint256) {
        return Balances.notionalValue(position, price);
    }

    function margin(Balances.Position calldata position, uint256 price) external pure returns (int256) {
        return Balances.margin(position, price);
    }

    function leveragedNotionalValue(Balances.Position calldata position, uint256 price)
        external
        pure
        returns (uint256)
    {
        return Balances.leveragedNotionalValue(position, price);
    }

    function minimumMargin(
        Balances.Position calldata position,
        uint256 price,
        uint256 liquidationGasCost,
        uint256 maximumLeverage
    ) external pure returns (uint256) {
        return Balances.minimumMargin(position, price, liquidationGasCost, maximumLeverage);
    }

    function marginIsValid(
        Balances.Position memory position,
        uint256 gasCost,
        uint256 price,
        uint256 trueMaxLeverage
    ) external pure returns (bool) {
        return Balances.marginIsValid(position, gasCost, price, trueMaxLeverage);
    }

    function applyTrade(
        Balances.Position calldata position,
        Balances.Trade calldata trade,
        uint256 feeRate
    ) external pure returns (Balances.Position memory) {
        return Balances.applyTrade(position, trade, feeRate);
    }

    function tokenToWad(uint256 tokenDecimals, uint256 amount) external pure returns (int256) {
        return Balances.tokenToWad(tokenDecimals, amount);
    }

    function wadToToken(uint256 tokenDecimals, uint256 wadAmount) external pure returns (uint256) {
        return Balances.wadToToken(tokenDecimals, wadAmount);
    }
}
