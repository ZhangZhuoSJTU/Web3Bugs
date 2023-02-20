// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "./liquidity/LPoolInterface.sol";
import "./lib/TransferHelper.sol";

library Types {
    using TransferHelper for IERC20;

    struct Market {// Market info
        LPoolInterface pool0;       // Lending Pool 0
        LPoolInterface pool1;       // Lending Pool 1
        address token0;              // Lending Token 0
        address token1;              // Lending Token 1
        uint16 marginLimit;         // Margin ratio limit for specific trading pair. Two decimal in percentage, ex. 15.32% => 1532
        uint16 feesRate;            // feesRate 30=>0.3%
        uint16 priceDiffientRatio;
        address priceUpdater;
        uint pool0Insurance;        // Insurance balance for token 0
        uint pool1Insurance;        // Insurance balance for token 1
        uint32[] dexs;
    }

    struct Trade {// Trade storage
        uint deposited;             // Balance of deposit token
        uint held;                  // Balance of held position
        bool depositToken;          // Indicate if the deposit token is token 0 or token 1
        uint128 lastBlockNum;       // Block number when the trade was touched last time, to prevent more than one operation within same block
    }

    struct MarketVars {// A variables holder for market info
        LPoolInterface buyPool;     // Lending pool address of the token to buy. It's a calculated field on open or close trade.
        LPoolInterface sellPool;    // Lending pool address of the token to sell. It's a calculated field on open or close trade.
        IERC20 buyToken;            // Token to buy
        IERC20 sellToken;           // Token to sell
        uint reserveBuyToken;
        uint reserveSellToken;
        uint buyPoolInsurance;      // Insurance balance of token to buy
        uint sellPoolInsurance;     // Insurance balance of token to sell
        uint16 marginLimit;         // Margin Ratio Limit for specific trading pair.
        uint16 priceDiffientRatio;
        uint32[] dexs;
    }

    struct TradeVars {// A variables holder for trade info
        uint depositValue;          // Deposit value
        IERC20 depositErc20;        // Deposit Token address
        uint fees;                  // Fees value
        uint depositAfterFees;      // Deposit minus fees
        uint tradeSize;             // Trade amount to be swap on DEX
        uint newHeld;               // Latest held position
        uint borrowValue;
        uint token0Price;
        uint32 dexDetail;
        uint totalHeld;
    }

    struct CloseTradeVars {// A variables holder for close trade info
        uint16 marketId;
        bool longToken;
        bool depositToken;
        uint closeRatio;          // Close ratio
        bool isPartialClose;        // Is partial close
        uint closeAmountAfterFees;  // Close amount sub Fees value
        uint borrowed;
        uint repayAmount;           // Repay to pool value
        uint depositDecrease;       // Deposit decrease
        uint depositReturn;         // Deposit actual returns
        uint sellAmount;
        uint receiveAmount;
        uint token0Price;
        uint fees;                  // Fees value
        uint32 dexDetail;
    }


    struct LiquidateVars {// A variable holder for liquidation process
        uint16 marketId;
        bool longToken;
        uint borrowed;              // Total borrowed balance of trade
        uint fees;                  // Fees for liquidation process
        uint penalty;               // Penalty
        uint remainAmountAfterFees;   // Held-fees-penalty
        bool isSellAllHeld;         // Is need sell all held
        uint depositDecrease;       // Deposit decrease
        uint depositReturn;         // Deposit actual returns
        uint sellAmount;
        uint receiveAmount;
        uint token0Price;
        uint outstandingAmount;
        uint finalRepayAmount;
        uint32 dexDetail;
    }

    struct MarginRatioVars {
        address heldToken;
        address sellToken;
        address owner;
        uint held;
        bytes dexData;
        uint16 multiplier;
        uint price;
        uint cAvgPrice;
        uint hAvgPrice; 
        uint8 decimals;
        uint lastUpdateTime;
    }
}
