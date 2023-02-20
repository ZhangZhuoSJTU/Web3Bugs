// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./ICToken.sol";

// Based on CErc20Interface in https://github.com/compound-finance/compound-protocol/blob/v2.8.1/contracts/CTokenInterfaces.sol
// and documentation at https://compound.finance/docs/ctokens
interface ICErc20 is ICToken {
    /// Underlying asset for this CToken
    function underlying() external view returns (address);

    /// The mint function transfers an asset into the protocol, which begins accumulating interest based
    /// on the current Supply Rate for the asset. The user receives a quantity of cTokens equal to the
    /// underlying tokens supplied, divided by the current Exchange Rate.
    /// @param mintAmount The amount of the asset to be supplied, in units of the underlying asset.
    /// @return 0 on success, otherwise an Error code
    function mint(uint mintAmount) external returns (uint);

    /// The redeem function converts a specified quantity of cTokens into the underlying asset, and returns
    /// them to the user. The amount of underlying tokens received is equal to the quantity of cTokens redeemed,
    /// multiplied by the current Exchange Rate. The amount redeemed must be less than the user's Account Liquidity
    /// and the market's available liquidity.
    /// @param redeemTokens The number of cTokens to be redeemed.
    /// @return 0 on success, otherwise an Error code
    function redeem(uint redeemTokens) external returns (uint);
}
