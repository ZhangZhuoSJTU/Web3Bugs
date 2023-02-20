// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.6.10;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Different types of internal tokens
///  - UnderlyingToken: underlying asset for a cToken (except for Ether)
///  - cToken: Compound interest bearing token
///  - cETH: Special handling for cETH tokens
///  - Ether: the one and only
///  - NonMintable: tokens that do not have an underlying (therefore not cTokens)
enum TokenType {
    UnderlyingToken,
    cToken,
    cETH,
    Ether,
    NonMintable
}

interface IWrappedfCash {
    function initialize(uint16 currencyId, uint40 maturity) external;

    /// @notice Mints wrapped fCash ERC20 tokens
    function mintViaAsset(
        uint256 depositAmountExternal,
        uint88 fCashAmount,
        address receiver,
        uint32 minImpliedRate
    ) external;

    function mintViaUnderlying(
        uint256 depositAmountExternal,
        uint88 fCashAmount,
        address receiver,
        uint32 minImpliedRate
    ) external;

    function redeemToAsset(uint256 amount, address receiver, uint32 maxImpliedRate) external;
    function redeemToUnderlying(uint256 amount, address receiver, uint32 maxImpliedRate) external;

    /// @notice Returns the underlying fCash ID of the token
    function getfCashId() external view returns (uint256);

    /// @notice True if the fCash has matured, assets mature exactly on the block time
    function hasMatured() external view returns (bool);

    /// @notice Returns the components of the fCash idd
    function getDecodedID() external view returns (uint16 currencyId, uint40 maturity);

    /// @notice Returns the current market index for this fCash asset. If this returns
    /// zero that means it is idiosyncratic and cannot be traded.
    function getMarketIndex() external view returns (uint8);

    /// @notice Returns the token and precision of the token that this token settles
    /// to. For example, fUSDC will return the USDC token address and 1e6. The zero
    /// address will represent ETH.
    function getUnderlyingToken() external view returns (IERC20 underlyingToken, int256 underlyingPrecision);

    /// @notice Returns the asset token which the fCash settles to. This will be an interest
    /// bearing token like a cToken or aToken.
    function getAssetToken() external view returns (IERC20 assetToken, int256 assetPrecision, TokenType tokenType);

    function getToken(bool useUnderlying) external view returns (IERC20 token, bool isETH);
}


interface IWrappedfCashComplete is IWrappedfCash, IERC20 {} 
