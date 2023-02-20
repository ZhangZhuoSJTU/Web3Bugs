// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/balances/TokenHandler.sol";
import "../global/StorageLayoutV1.sol";

contract MockTokenHandler is StorageLayoutV1 {
    using TokenHandler for Token;

    function setMaxCurrencyId(uint16 num) external {
        maxCurrencyId = num;
    }

    function setCurrencyMapping(
        uint256 id,
        bool underlying,
        TokenStorage calldata ts
    ) external {
        return TokenHandler.setToken(id, underlying, ts);
    }

    /// @dev This method does not update internal balances...must use currency handler.

    function transfer(
        uint256 currencyId,
        address account,
        bool underlying,
        int256 netTransfer
    ) external returns (int256) {
        Token memory token = TokenHandler.getToken(currencyId, underlying);
        return token.transfer(account, netTransfer);
    }

    function mint(uint256 currencyId, uint256 underlyingAmount) external returns (int256) {
        Token memory token = TokenHandler.getToken(currencyId, false);
        return token.mint(underlyingAmount);
    }

    function redeem(uint256 currencyId, uint256 tokensInternalPrecision) external returns (int256) {
        Token memory token = TokenHandler.getToken(currencyId, false);
        Token memory underlyingToken = TokenHandler.getToken(currencyId, true);
        return token.redeem(underlyingToken, tokensInternalPrecision);
    }

    function getToken(uint256 currencyId, bool underlying) external view returns (Token memory) {
        return TokenHandler.getToken(currencyId, underlying);
    }
}
