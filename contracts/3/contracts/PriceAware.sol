// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./RoleAware.sol";
import "./MarginRouter.sol";
import "../libraries/UniswapStyleLib.sol";

/// Stores how many of token you could get for 1k of peg
struct TokenPrice {
    uint256 blockLastUpdated;
    uint256 tokenPer1k;
    address[] liquidationPairs;
    address[] inverseLiquidationPairs;
    address[] liquidationTokens;
    address[] inverseLiquidationTokens;
}

/// @title The protocol features several mechanisms to prevent vulnerability to
/// price manipulation:
/// 1) global exposure caps on all tokens which need to be raised gradually
///    during the process of introducing a new token, making attacks unprofitable
///    due to lack  of scale
/// 2) Exponential moving average with cautious price update. Prices for estimating
///    how much a trader can borrow need not be extremely current and precise, mainly
///    they must be resilient against extreme manipulation
/// 3) Liquidators may not call from a contract address, to prevent extreme forms of
///    of front-running and other price manipulation.
abstract contract PriceAware is Ownable, RoleAware {
    address public immutable peg;
    mapping(address => TokenPrice) public tokenPrices;
    /// update window in blocks
    uint16 public priceUpdateWindow = 8;
    uint256 public UPDATE_RATE_PERMIL = 80;
    uint256 public UPDATE_MAX_PEG_AMOUNT = 50_000;
    uint256 public UPDATE_MIN_PEG_AMOUNT = 1_000;

    constructor(address _peg) Ownable() {
        peg = _peg;
    }

    /// Set window for price updates
    function setPriceUpdateWindow(uint16 window) external onlyOwner {
        priceUpdateWindow = window;
    }

    /// Set rate for updates
    function setUpdateRate(uint256 rate) external onlyOwner {
        UPDATE_RATE_PERMIL = rate;
    }

    function setUpdateMaxPegAmount(uint256 amount) external onlyOwner {
        UPDATE_MAX_PEG_AMOUNT = amount;
    }

    function setUpdateMinPegAmount(uint256 amount) external onlyOwner {
        UPDATE_MIN_PEG_AMOUNT = amount;
    }

    /// Get current price of token in peg
    function getCurrentPriceInPeg(
        address token,
        uint256 inAmount,
        bool forceCurBlock
    ) public returns (uint256) {
        TokenPrice storage tokenPrice = tokenPrices[token];
        if (forceCurBlock) {
            if (
                block.number - tokenPrice.blockLastUpdated > priceUpdateWindow
            ) {
                // update the currently cached price
                return getPriceFromAMM(token, inAmount);
            } else {
                // just get the current price from AMM
                return viewCurrentPriceInPeg(token, inAmount);
            }
        } else if (tokenPrice.tokenPer1k == 0) {
            // do the best we can if it's at zero
            return getPriceFromAMM(token, inAmount);
        }

        if (block.number - tokenPrice.blockLastUpdated > priceUpdateWindow) {
            // update the price somewhat
            getPriceFromAMM(token, inAmount);
        }

        return (inAmount * 1000 ether) / tokenPrice.tokenPer1k;
    }

    /// Get view of current price of token in peg
    function viewCurrentPriceInPeg(address token, uint256 inAmount)
        public
        view
        returns (uint256)
    {
        if (token == peg) {
            return inAmount;
        } else {
            TokenPrice storage tokenPrice = tokenPrices[token];
            uint256[] memory pathAmounts =
                UniswapStyleLib.getAmountsOut(
                    inAmount,
                    tokenPrice.liquidationPairs,
                    tokenPrice.liquidationTokens
                );
            uint256 outAmount = pathAmounts[pathAmounts.length - 1];
            return outAmount;
        }
    }

    /// @dev retrieves the price from the AMM
    function getPriceFromAMM(address token, uint256 inAmount)
        internal
        virtual
        returns (uint256)
    {
        if (token == peg) {
            return inAmount;
        } else {
            TokenPrice storage tokenPrice = tokenPrices[token];
            uint256[] memory pathAmounts =
                UniswapStyleLib.getAmountsOut(
                    inAmount,
                    tokenPrice.liquidationPairs,
                    tokenPrice.liquidationTokens
                );
            uint256 outAmount = pathAmounts[pathAmounts.length - 1];

            if (
                outAmount > UPDATE_MIN_PEG_AMOUNT &&
                outAmount < UPDATE_MAX_PEG_AMOUNT
            ) {
                setPriceVal(tokenPrice, inAmount, outAmount);
            }

            return outAmount;
        }
    }

    function setPriceVal(
        TokenPrice storage tokenPrice,
        uint256 inAmount,
        uint256 outAmount
    ) internal {
        _setPriceVal(tokenPrice, inAmount, outAmount, UPDATE_RATE_PERMIL);
        tokenPrice.blockLastUpdated = block.number;
    }

    function _setPriceVal(
        TokenPrice storage tokenPrice,
        uint256 inAmount,
        uint256 outAmount,
        uint256 weightPerMil
    ) internal {
        uint256 updatePer1k = (1000 ether * inAmount) / (outAmount + 1);
        tokenPrice.tokenPer1k =
            (tokenPrice.tokenPer1k *
                (1000 - weightPerMil) +
                updatePer1k *
                weightPerMil) /
            1000;
    }

    /// add path from token to current liquidation peg
    function setLiquidationPath(address[] memory path, address[] memory tokens)
        external
    {
        require(
            isTokenActivator(msg.sender),
            "not authorized to set lending cap"
        );

        address token = tokens[0];

        TokenPrice storage tokenPrice = tokenPrices[token];
        tokenPrice.liquidationPairs = new address[](path.length);
        tokenPrice.inverseLiquidationPairs = new address[](path.length);
        tokenPrice.liquidationTokens = new address[](tokens.length);
        tokenPrice.inverseLiquidationTokens = new address[](tokens.length);

        for (uint256 i = 0; path.length > i; i++) {
            tokenPrice.liquidationPairs[i] = path[i];
            tokenPrice.inverseLiquidationPairs[i] = path[path.length - i - 1];
        }

        for (uint256 i = 0; tokens.length > i; i++) {
            tokenPrice.liquidationTokens[i] = tokens[i];
            tokenPrice.inverseLiquidationTokens[i] = tokens[
                tokens.length - i - 1
            ];
        }

        uint256[] memory pathAmounts =
            UniswapStyleLib.getAmountsIn(1000 ether, path, tokens);
        uint256 inAmount = pathAmounts[0];
        _setPriceVal(tokenPrice, inAmount, 1000 ether, 1000);
    }

    function liquidateToPeg(address token, uint256 amount)
        internal
        returns (uint256)
    {
        if (token == peg) {
            return amount;
        } else {
            TokenPrice storage tP = tokenPrices[token];
            uint256[] memory amounts =
                MarginRouter(router()).authorizedSwapExactT4T(
                    amount,
                    0,
                    tP.liquidationPairs,
                    tP.liquidationTokens
                );

            uint256 outAmount = amounts[amounts.length - 1];

            return outAmount;
        }
    }

    function liquidateFromPeg(address token, uint256 targetAmount)
        internal
        returns (uint256)
    {
        if (token == peg) {
            return targetAmount;
        } else {
            TokenPrice storage tP = tokenPrices[token];
            uint256[] memory amounts =
                MarginRouter(router()).authorizedSwapT4ExactT(
                    targetAmount,
                    type(uint256).max,
                    tP.inverseLiquidationPairs,
                    tP.inverseLiquidationTokens
                );

            return amounts[0];
        }
    }
}
