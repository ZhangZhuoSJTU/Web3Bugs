// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.7;

import "./ILongShortToken.sol";
import "./IStrategyController.sol";

/**
 * @notice Users can mint/redeem long/short positions on a specific asset in
 * exchange for Collateral tokens.
 * @dev Position settlement prices are bound by a floor and ceiling set
 * during market initialization.
 *
 * The value of a Long and Short token should always equal 1 Collateral.
 */
interface IPrePOMarket {
    /// @dev Emitted via `constructor()`
    /// @param longToken Market Long token address
    /// @param shortToken Market Short token address
    /// @param shortToken Market Short token address
    /// @param floorLongPrice Long token price floor
    /// @param ceilingLongPrice Long token price ceiling
    /// @param floorValuation Market valuation floor
    /// @param ceilingValuation Market valuation ceiling
    /// @param mintingFee Market minting fee
    /// @param redemptionFee Market redemption fee
    /// @param expiryTime Market expiry time
    event MarketCreated(
        address longToken,
        address shortToken,
        uint256 floorLongPrice,
        uint256 ceilingLongPrice,
        uint256 floorValuation,
        uint256 ceilingValuation,
        uint256 mintingFee,
        uint256 redemptionFee,
        uint256 expiryTime
    );

    /// @dev Emitted via `mintLongShortTokens()`.
    /// @param minter The address of the minter
    /// @param amount The amount of Long/Short tokens minted
    event Mint(address indexed minter, uint256 amount);

    /// @dev Emitted via `redeem()`.
    /// @param redeemer The address of the redeemer
    /// @param amount The amount of Long/Short tokens redeemed
    event Redemption(address indexed redeemer, uint256 amount);

    /// @dev Emitted via `setTreasury()`.
    /// @param treasury The new treasury address
    event TreasuryChanged(address treasury);

    /// @dev Emitted via `setFinalLongPrice()`.
    /// @param price The final Long price
    event FinalLongPriceSet(uint256 price);

    /// @dev Emitted via `setMintingFee()`.
    /// @param fee The new minting fee
    event MintingFeeChanged(uint256 fee);

    /// @dev Emitted via `setRedemptionFee()`.
    /// @param fee The new redemption fee
    event RedemptionFeeChanged(uint256 fee);

    /// @dev Emitted via `setPublicMinting()`.
    /// @param allowed The new public minting status
    event PublicMintingChanged(bool allowed);

    /**
     * @notice Mints Long and Short tokens in exchange for `amount`
     * Collateral.
     * @dev Minting is not allowed after the market has ended.
     *
     * `owner()` may mint tokens before PublicMinting is enabled to
     * bootstrap a market with an initial supply.
     * @param amount Amount of Collateral to deposit
     * @return Long/Short tokens minted
     */
    function mintLongShortTokens(uint256 amount) external returns (uint256);

    /**
     * @notice Redeem `longAmount` Long and `shortAmount` Short tokens for
     * Collateral.
     * @dev Before the market ends, redemptions can only be done with equal
     * parts N Long/Short tokens for N Collateral.
     *
     * After the market has ended, users can redeem any amount of
     * Long/Short tokens for Collateral.
     * @param longAmount Amount of Long tokens to redeem
     * @param shortAmount Amount of Short tokens to redeem
     */
    function redeem(uint256 longAmount, uint256 shortAmount) external;

    /**
     * @notice Sets the treasury address minting/redemption fees are sent to.
     * @dev Only callable by `owner()`.
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external;

    /**
     * @notice Sets the price a Long token can be redeemed for after the
     * market has ended (in wei units of Collateral).
     * @dev The contract initializes this to > MAX_PRICE and knows the market
     * has ended when it is set to <= MAX_PRICE.
     *
     * Only callable by `owner()`.
     * @param newFinalLongPrice Price to set Long token redemptions
     */
    function setFinalLongPrice(uint256 newFinalLongPrice) external;

    /**
     * @notice Sets the fee for minting Long/Short tokens, must be a 4
     * decimal place percentage value e.g. 4.9999% = 49999.
     * @dev Only callable by `owner()`.
     * @param newMintingFee New minting fee
     */
    function setMintingFee(uint256 newMintingFee) external;

    /**
     * @notice Sets the fee for redeeming Long/Short tokens, must be a 4
     * decimal place percentage value e.g. 4.9999% = 49999.
     * @dev Only callable by `owner()`.
     * @param newRedemptionFee New redemption fee
     */
    function setRedemptionFee(uint256 newRedemptionFee) external;

    /**
     * @notice Sets whether or not everyone is allowed to mint Long/Short
     * tokens.
     * @dev Only callable by `owner()`.
     * @param allowed Whether or not to allow everyone to mint Long/Short
     */
    function setPublicMinting(bool allowed) external;

    /// @return Treasury address where minting/redemption fees are sent
    function getTreasury() external view returns (address);

    /// @return Collateral token used to fund Long/Short positions
    function getCollateral() external view returns (IERC20);

    /**
     * @dev The PrePOMarket is the owner of this token contract.
     * @return Long token for this market
     */
    function getLongToken() external view returns (ILongShortToken);

    /**
     * @dev The PrePOMarket is the owner of this token contract.
     * @return Short token for this market
     */
    function getShortToken() external view returns (ILongShortToken);

    /**
     * @notice Returns the lower bound of what a Long token can be priced at
     * (in wei units of Collateral).
     * @dev Must be less than ceilingLongPrice and MAX_PRICE.
     * @return Minimum Long token price
     */
    function getFloorLongPrice() external view returns (uint256);

    /**
     * @notice Returns the upper bound of what a Long token can be priced at
     * (in wei units of Collateral).
     * @dev Must be less than MAX_PRICE.
     * @return Maximum Long token price
     */
    function getCeilingLongPrice() external view returns (uint256);

    /**
     * @notice Returns the price a Long token can be redeemed for after the
     * market has ended (in wei units of Collateral).
     * @dev The contract initializes this to > MAX_PRICE and knows the market
     * has ended when it is set to <= MAX_PRICE.
     * @return Final Long token price
     */
    function getFinalLongPrice() external view returns (uint256);

    /**
     * @notice Returns valuation of a market when the price of a Long
     * token is at the floor.
     * @return Market valuation floor
     */
    function getFloorValuation() external view returns (uint256);

    /**
     * @notice Returns valuation of a market when the price of a Long
     * token is at the ceiling.
     * @return Market valuation ceiling
     */
    function getCeilingValuation() external view returns (uint256);

    /**
     * @notice Returns the fee for minting Long/Short tokens as a 4 decimal
     * place percentage value e.g. 4.9999% = 49999.
     * @return Minting fee
     */
    function getMintingFee() external view returns (uint256);

    /**
     * @notice Returns the fee for redeeming Long/Short tokens as a 4 decimal
     * place percentage value e.g. 4.9999% = 49999.
     * @return Redemption fee
     */
    function getRedemptionFee() external view returns (uint256);

    /**
     * @notice Returns the timestamp of when the market will expire.
     * @return Market expiry timestamp
     */
    function getExpiryTime() external view returns (uint256);

    /**
     * @notice Returns whether Long/Short token minting is open to everyone.
     * @dev If true, anyone can mint Long/Short tokens, if false, only
     * `owner()` may mint.
     * @return Whether or not public minting is allowed
     */
    function isPublicMintingAllowed() external view returns (bool);

    /**
     * @notice Long prices cannot exceed this value, equivalent to 1 ether
     * unit of Collateral.
     * @return Max Long token price
     */
    function getMaxPrice() external pure returns (uint256);

    /**
     * @notice Returns the denominator for calculating fees from 4 decimal
     * place percentage values e.g. 4.9999% = 49999.
     * @return Denominator for calculating fees
     */
    function getFeeDenominator() external pure returns (uint256);

    /**
     * @notice Fee limit of 5% represented as 4 decimal place percentage
     * value e.g. 4.9999% = 49999.
     * @return Fee limit
     */
    function getFeeLimit() external pure returns (uint256);
}
