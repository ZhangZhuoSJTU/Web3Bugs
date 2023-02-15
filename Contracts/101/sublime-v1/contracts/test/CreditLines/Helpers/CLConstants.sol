// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

library CLConstants {
    uint128 constant minBorrowLimit = 1e8; // $100
    uint128 constant maxBorrowLimit = 1e15; // $1,000,000,000

    uint128 constant minCollateralRatio = 1;
    uint128 constant maxCollteralRatio = 1e30;

    uint128 constant minBorrowRate = 1;
    uint128 constant maxBorrowRate = 1e30;

    uint256 public constant maxStrategies = 10;

    uint256 public constant protocolFeeFraction = 10e16;

    uint256 public constant liquidatorRewardFraction = 10e15;

    uint32 public constant uniswapPriceAveragingPeriod = 10;

    address public constant hevmAddress = 0x7109709ECfa91a80626fF3989D68f67F5b1DD12D;
    address public constant BAT = 0x0D8775F648430679A709E98d2b0Cb6250d2887EF;
    address public constant USDC = 0xb7a4F3E9097C08dA09517b5aB877F7a917224ede;

    struct CreditLineConstants {
        bool autoLiquidation;
        bool requestByLender;
        uint256 borrowLimit;
        uint256 borrowRate;
        uint256 idealCollateralRatio;
        address lender;
        address borrower;
        address borrowAsset;
        address borrowAssetStrategy;
        address collateralAsset;
        address collateralStrategy;
    }

    struct RequestParams {
        address requestTo;
        uint128 borrowLimit;
        uint128 borrowRate;
        bool autoLiquidation;
        uint256 collateralRatio;
        address borrowAsset;
        address borrowAssetStrategy;
        address collateralAsset;
        address collateralStrategy;
        bool requestAsLender;
    }
}
