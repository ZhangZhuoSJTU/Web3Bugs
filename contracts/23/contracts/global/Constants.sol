// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.0;

/// @title All shared constants for the Notional system should be declared here.
library Constants {
    // Token precision used for all internal balances, TokenHandler library ensures that we
    // limit the dust amount caused by precision mismatches
    int256 internal constant INTERNAL_TOKEN_PRECISION = 1e8;

    // ETH will be initialized as the first currency
    uint256 internal constant ETH_CURRENCY_ID = 1;
    int256 internal constant ETH_DECIMAL_PLACES = 18;
    int256 internal constant ETH_DECIMALS = 1e18;

    // Used to when calculating the amount to deleverage of a market when minting nTokens
    uint256 internal constant DELEVERAGE_BUFFER = 30000000; // 300 * Constants.BASIS_POINT

    // Address of the reserve account
    address internal constant RESERVE = address(0);
    // NOTE: this address is hardcoded in the library, must update this on deployment
    address constant NOTE_TOKEN_ADDRESS = 0xCFEAead4947f0705A14ec42aC3D44129E1Ef3eD5;

    // Most significant bit
    bytes32 internal constant MSB =
        0x8000000000000000000000000000000000000000000000000000000000000000;

    // Basis for percentages
    int256 internal constant PERCENTAGE_DECIMALS = 100;
    // Max number of traded markets, also used as the maximum number of assets in a portfolio array
    uint256 internal constant MAX_TRADED_MARKET_INDEX = 7;
    // Max number of fCash assets in a bitmap, this is based on the gas costs of calculating free collateral
    // for a bitmap portfolio
    uint256 internal constant MAX_BITMAP_ASSETS = 20;

    // Internal date representations, note we use a 6/30/360 week/month/year convention here
    uint256 internal constant DAY = 86400;
    // We use six day weeks to ensure that all time references divide evenly
    uint256 internal constant WEEK = DAY * 6;
    uint256 internal constant MONTH = DAY * 30;
    uint256 internal constant QUARTER = DAY * 90;
    uint256 internal constant YEAR = QUARTER * 4;

    // Offsets for each time chunk denominated in days
    uint256 internal constant MAX_DAY_OFFSET = 90;
    uint256 internal constant MAX_WEEK_OFFSET = 360;
    uint256 internal constant MAX_MONTH_OFFSET = 2160;
    uint256 internal constant MAX_QUARTER_OFFSET = 7650;

    // Offsets for each time chunk denominated in bits
    uint256 internal constant WEEK_BIT_OFFSET = 90;
    uint256 internal constant MONTH_BIT_OFFSET = 135;
    uint256 internal constant QUARTER_BIT_OFFSET = 195;

    // This is a constant that represents the time period that all rates are normalized by, 360 days
    uint256 internal constant IMPLIED_RATE_TIME = 31104000;
    // Number of decimal places that rates are stored in, equals 100%
    int256 internal constant RATE_PRECISION = 1e9;
    uint256 internal constant BASIS_POINT = uint256(RATE_PRECISION / 10000);

    // This is the ABDK64x64 representation of RATE_PRECISION
    // RATE_PRECISION_64x64 = ABDKMath64x64.fromUint(RATE_PRECISION)
    int128 internal constant RATE_PRECISION_64x64 = 0x3b9aca000000000000000000;
    int128 internal constant LOG_RATE_PRECISION_64x64 = 382276781265598821176;

    uint256 internal constant FCASH_ASSET_TYPE = 1;
    // Liquidity token asset types are 1 + marketIndex (where marketIndex is 1-indexed)
    uint256 internal constant MIN_LIQUIDITY_TOKEN_INDEX = 2;
    uint256 internal constant MAX_LIQUIDITY_TOKEN_INDEX = 8;

    bytes1 internal constant BOOL_FALSE = 0x00;
    bytes1 internal constant BOOL_TRUE = 0x01;

    // Account context flags
    bytes1 internal constant HAS_ASSET_DEBT = 0x01;
    bytes1 internal constant HAS_CASH_DEBT = 0x02;
    bytes2 internal constant ACTIVE_IN_PORTFOLIO = 0x8000;
    bytes2 internal constant ACTIVE_IN_BALANCES = 0x4000;
    bytes2 internal constant UNMASK_FLAGS = 0x3FFF;
    uint16 internal constant MAX_CURRENCIES = uint16(UNMASK_FLAGS);

    // nToken Parameters
    int256 internal constant DEPOSIT_PERCENT_BASIS = 1e8;
    uint8 internal constant LIQUIDATION_HAIRCUT_PERCENTAGE = 0;
    uint8 internal constant CASH_WITHHOLDING_BUFFER = 1;
    uint8 internal constant RESIDUAL_PURCHASE_TIME_BUFFER = 2;
    uint8 internal constant PV_HAIRCUT_PERCENTAGE = 3;
    uint8 internal constant RESIDUAL_PURCHASE_INCENTIVE = 4;
    uint8 internal constant ASSET_ARRAY_LENGTH = 5;

    // Liquidation parameters
    /// @dev Default portion of collateral that a liquidator is allowed to liquidate, will be higher if the account
    /// requires more collateral to be liquidated
    int256 internal constant DEFAULT_LIQUIDATION_PORTION = 40;
    /// @dev Percentage of local liquidity token cash claim delivered to the liquidator for liquidating liquidity tokens
    int256 internal constant TOKEN_REPO_INCENTIVE_PERCENT = 10;
    /// @dev Liquidation dust setting used during fCash liquidation
    int256 internal constant LIQUIDATION_DUST = 10;

    // Pause Router liquidation enabled states
    bytes1 internal constant LOCAL_CURRENCY_ENABLED = 0x01;
    bytes1 internal constant COLLATERAL_CURRENCY_ENABLED = 0x02;
    bytes1 internal constant LOCAL_FCASH_ENABLED = 0x04;
    bytes1 internal constant CROSS_CURRENCY_FCASH_ENABLED = 0x08;

    /* Internal Storage Slot Offsets */
    // Internally used storage slots are set at 1000000 offset from the solidity provisioned storage slots to minimize
    // the possibility of clashing.
    uint256 internal constant ACCOUNT_CONTEXT_STORAGE_OFFSET = 1000001;
    uint256 internal constant NTOKEN_CONTEXT_STORAGE_OFFSET = 1000002;
    uint256 internal constant NTOKEN_ADDRESS_STORAGE_OFFSET = 1000003;
    uint256 internal constant NTOKEN_DEPOSIT_STORAGE_OFFSET = 1000004;
    uint256 internal constant NTOKEN_INIT_STORAGE_OFFSET = 1000005;
    uint256 internal constant BALANCE_STORAGE_OFFSET = 1000006;
    uint256 internal constant TOKEN_STORAGE_OFFSET = 1000007;
    uint256 internal constant SETTLEMENT_RATE_STORAGE_OFFSET = 1000008;
    uint256 internal constant CASH_GROUP_STORAGE_OFFSET = 1000009;
    uint256 internal constant MARKET_STORAGE_OFFSET = 1000010;
    uint256 internal constant ASSETS_BITMAP_STORAGE_OFFSET = 1000011;
    uint256 internal constant IFCASH_STORAGE_OFFSET = 1000012;
    uint256 internal constant PORTFOLIO_ARRAY_STORAGE_OFFSET = 1000013;
    uint256 internal constant NTOKEN_TOTAL_SUPPLY_OFFSET = 1000014;
}
