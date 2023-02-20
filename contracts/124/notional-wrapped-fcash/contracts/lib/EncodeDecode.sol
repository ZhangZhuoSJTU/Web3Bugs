// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "./Constants.sol";
import "./Types.sol";

library EncodeDecode {

    /// @notice Decodes asset ids
    function decodeERC1155Id(uint256 id)
        internal
        pure
        returns (
            uint16 currencyId,
            uint40 maturity,
            uint8 assetType
        )
    {
        assetType = uint8(id);
        maturity = uint40(id >> 8);
        currencyId = uint16(id >> 48);
    }

    /// @notice Encodes asset ids
    function encodeERC1155Id(
        uint256 currencyId,
        uint256 maturity,
        uint256 assetType
    ) internal pure returns (uint256) {
        require(currencyId <= Constants.MAX_CURRENCIES);
        require(maturity <= type(uint40).max);
        require(assetType <= Constants.MAX_LIQUIDITY_TOKEN_INDEX);

        return
            uint256(
                (bytes32(uint256(uint16(currencyId))) << 48) |
                (bytes32(uint256(uint40(maturity))) << 8) |
                bytes32(uint256(uint8(assetType)))
            );
    }

    function encodeLendTrade(
        uint16 currencyId,
        uint8 marketIndex,
        uint88 fCashAmount,
        uint32 minImpliedRate,
        bool useUnderlying
    ) internal pure returns (BatchLend[] memory action) {
        action = new BatchLend[](1);
        action[0].currencyId = currencyId;
        action[0].depositUnderlying = useUnderlying;
        action[0].trades = new bytes32[](1);
        action[0].trades[0] = bytes32(
            (uint256(uint8(TradeActionType.Lend)) << 248) |
            (uint256(marketIndex) << 240) |
            (uint256(fCashAmount) << 152) |
            (uint256(minImpliedRate) << 120)
        );
    }

    function encodeLendETHTrade(
        uint16 currencyId,
        uint8 marketIndex,
        uint256 depositAmountExternal,
        uint88 fCashAmount,
        uint32 minImpliedRate
    ) internal pure returns (BalanceActionWithTrades[] memory action) {
        action = new BalanceActionWithTrades[](1);
        action[0].actionType = DepositActionType.DepositUnderlying;
        action[0].currencyId = currencyId;
        action[0].depositActionAmount = depositAmountExternal;
        action[0].withdrawEntireCashBalance = true;
        action[0].redeemToUnderlying = true;
        action[0].trades = new bytes32[](1);
        action[0].trades[0] = bytes32(
            (uint256(uint8(TradeActionType.Lend)) << 248) |
            (uint256(marketIndex) << 240) |
            (uint256(fCashAmount) << 152) |
            (uint256(minImpliedRate) << 120)
        );
    }

    function encodeBorrowTrade(
        uint16 currencyId,
        uint8 marketIndex,
        uint88 fCashAmount,
        uint32 maxImpliedRate,
        bool toUnderlying
    ) internal pure returns (BalanceActionWithTrades[] memory action) {
        action = new BalanceActionWithTrades[](1);
        action[0].actionType = DepositActionType.None;
        action[0].currencyId = currencyId;
        action[0].withdrawEntireCashBalance = true;
        action[0].redeemToUnderlying = toUnderlying;
        action[0].trades = new bytes32[](1);
        action[0].trades[0] = bytes32(
            (uint256(uint8(TradeActionType.Borrow)) << 248) |
            (uint256(marketIndex) << 240) |
            (uint256(fCashAmount) << 152) |
            (uint256(maxImpliedRate) << 120)
        );
    }
}